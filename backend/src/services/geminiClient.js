const { GoogleGenAI } = require('@google/genai');

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('[Gemini Client] Warning: GEMINI_API_KEY is not set in environment!');
}

const ai = new GoogleGenAI({ apiKey });

// Fallback chain, tried in order. Override with GEMINI_MODELS=model-a,model-b in .env.
// Ordered for speed: answering from retrieved passages doesn't need a big
// reasoning model, and every extra "thinking" token is time the user waits.
const DEFAULT_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
];
const MODELS = (process.env.GEMINI_MODELS || '')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);
if (MODELS.length === 0) MODELS.push(...DEFAULT_MODELS);

/**
 * Thinking is the biggest source of latency: Gemini 3.x Flash models reason
 * before answering ("medium" by default on 3.6/3.8 Flash). For grounded Q&A,
 * quizzes and summaries we turn it down as far as each model allows.
 * Set GEMINI_THINKING=default in .env to leave the model defaults alone.
 * (Allowed values per model: ai.google.dev/gemini-api/docs/thinking)
 */
function thinkingConfigFor(model) {
  if (process.env.GEMINI_THINKING === 'default') return null;
  if (/^gemini-2\.5-flash/.test(model)) return { thinkingBudget: 0 };
  if (/^gemini-3\.8-flash/.test(model) || /^gemini-4/.test(model)) return { thinkingLevel: 'LOW' };
  if (/^gemini-3/.test(model)) return { thinkingLevel: 'MINIMAL' };
  return null;
}

// Models that returned 404 are skipped for the rest of the process lifetime.
const unavailableModels = new Set();
// Models that rejected our thinking setting; we stop sending it to them.
const noThinkingConfig = new Set();

// Rolling record of real generation latency, shown on the Analytics page.
const latencySamples = [];
function recordLatency(ms) {
  latencySamples.push(ms);
  if (latencySamples.length > 200) latencySamples.shift();
}
function getAverageLatencyMs() {
  if (latencySamples.length === 0) return null;
  return Math.round(latencySamples.reduce((a, b) => a + b, 0) / latencySamples.length);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A model that hangs should not keep the user waiting forever: give up after
// AI_TIMEOUT_MS and try the next model in the list.
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 60000;
function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const e = new Error(`AI request timed out after ${Math.round(ms / 1000)} s`);
      e.status = 504;
      reject(e);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Cleanly format API errors so the frontend doesn't receive raw JSON strings
 */
function cleanErrorMessage(err) {
  if (!err) return 'An unexpected error occurred. Please try again.';
  const msg = typeof err === 'string' ? err : err.message || '';

  if (msg.includes('503') || msg.includes('high demand') || msg.includes('UNAVAILABLE')) {
    return 'Google Gemini AI servers are currently experiencing temporary high traffic. Please retry in a few moments.';
  }
  if (msg.includes('timed out')) {
    return 'The AI took too long to respond. Please try again.';
  }
  if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
    return 'API rate limit reached. Please wait a few seconds and try again.';
  }
  if (msg.includes('404') || msg.includes('NOT_FOUND')) {
    return 'None of the configured Gemini models are available. Check GEMINI_MODELS in backend/.env.';
  }
  if (msg.includes('API key not valid') || msg.includes('API_KEY_INVALID') || msg.includes('PERMISSION_DENIED')) {
    return 'The Gemini API key was rejected. Check GEMINI_API_KEY in backend/.env.';
  }
  return msg;
}

function buildRequest(options, model) {
  const config = { ...(options.config || {}) };
  const thinking = noThinkingConfig.has(model) ? null : thinkingConfigFor(model);
  if (thinking && !config.thinkingConfig) config.thinkingConfig = thinking;
  return { ...options, model, config };
}

function isThinkingConfigError(err) {
  const msg = err?.message || '';
  return (err?.status === 400 || msg.includes('400') || msg.includes('INVALID_ARGUMENT')) && /thinking/i.test(msg);
}

function isTransient(err) {
  const msg = err?.message || '';
  return err?.status === 503 || err?.status === 429 || msg.includes('503') || msg.includes('high demand');
}

/**
 * Shared fallback loop. `run(request)` performs one attempt against one model.
 * For streaming, the caller's run() throws only if nothing was streamed yet,
 * so a half-written answer is never restarted on another model.
 */
async function withFallback(options, run, { label = 'generate', maxRetriesPerModel = 1 } = {}) {
  let lastError = null;
  const candidates = MODELS.filter((m) => !unavailableModels.has(m));

  for (const model of candidates.length ? candidates : MODELS) {
    for (let attempt = 0; attempt <= maxRetriesPerModel; attempt++) {
      const started = Date.now();
      try {
        const result = await run(buildRequest(options, model));
        const ms = Date.now() - started;
        recordLatency(ms);
        console.log(`[Gemini] ${label} via ${model} in ${ms} ms`);
        return result;
      } catch (err) {
        lastError = err;
        if (err?.alreadyStreamed) throw err;

        if (isThinkingConfigError(err) && !noThinkingConfig.has(model)) {
          // This model doesn't accept our thinking setting; retry it once without.
          noThinkingConfig.add(model);
          attempt--;
          continue;
        }
        if (err?.status === 404 || err?.message?.includes('NOT_FOUND')) {
          unavailableModels.add(model);
        }

        console.warn(`[Gemini] ${label}: '${model}' attempt ${attempt + 1} failed: ${err.message?.slice(0, 120)}`);

        if (isTransient(err) && attempt < maxRetriesPerModel) {
          await sleep(800);
        } else {
          break; // move straight on to the next model
        }
      }
    }
  }

  const failureError = new Error(cleanErrorMessage(lastError));
  failureError.originalError = lastError;
  throw failureError;
}

/**
 * generateContent with multi-model fallback and retry on transient errors.
 */
function callGeminiWithFallback(options, { label } = {}) {
  return withFallback(options, (request) => withTimeout(ai.models.generateContent(request), AI_TIMEOUT_MS), { label });
}

/**
 * Streams the answer. onText(textSoFarDelta) is called for every chunk.
 * Resolves with the full text.
 */
function streamGeminiWithFallback(options, onText, { label = 'stream' } = {}) {
  return withFallback(
    options,
    async (request) => {
      let full = '';
      try {
        const stream = await ai.models.generateContentStream(request);
        for await (const chunk of stream) {
          const delta = chunk.text || '';
          if (delta) {
            full += delta;
            onText(delta);
          }
        }
      } catch (err) {
        if (full) err.alreadyStreamed = true;
        throw err;
      }
      return full;
    },
    { label }
  );
}

module.exports = {
  ai,
  MODELS,
  callGeminiWithFallback,
  streamGeminiWithFallback,
  getAverageLatencyMs,
  cleanErrorMessage,
};
