const { GoogleGenAI } = require('@google/genai');

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('[Gemini Client] Warning: GEMINI_API_KEY is not set in environment!');
}

const ai = new GoogleGenAI({ apiKey });

// Prioritize currently healthiest, high-throughput models with active server capacity
const MODELS = [
  'gemini-3.5-flash',              // Primary: Verified active, high throughput, fast response
  'gemini-3.5-flash-lite',         // Secondary: High throughput fallback
  'gemini-flash-lite-latest',      // Tertiary: Dynamic alias fallback
  'gemini-3-flash-preview',        // Quaternary fallback
  'gemini-3.1-flash-lite-preview',  // Quinary fallback
  'gemini-3.8-flash',              // Senary fallback
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Cleanly format API errors so the frontend doesn't receive raw JSON strings
 */
function cleanErrorMessage(err) {
  if (!err) return 'An unexpected error occurred. Please try again.';
  const msg = typeof err === 'string' ? err : err.message || '';

  if (msg.includes('503') || msg.includes('high demand') || msg.includes('UNAVAILABLE')) {
    return 'Google Gemini AI servers are currently experiencing temporary high traffic. Please retry in a few moments.';
  }
  if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
    return 'API rate limit reached. Please wait a few seconds and try again.';
  }
  if (msg.includes('404') || msg.includes('NOT_FOUND')) {
    return 'Selected AI model is currently unavailable.';
  }
  return msg;
}

/**
 * Execute Gemini generateContent with multi-model fallback and backoff retry
 */
async function callGeminiWithFallback(options, maxRetriesPerModel = 1) {
  let lastError = null;

  for (const model of MODELS) {
    for (let attempt = 0; attempt <= maxRetriesPerModel; attempt++) {
      try {
        const response = await ai.models.generateContent({
          ...options,
          model,
        });
        return response;
      } catch (err) {
        lastError = err;
        const isTransient =
          err?.status === 503 ||
          err?.message?.includes('503') ||
          err?.message?.includes('high demand') ||
          err?.status === 429;

        console.warn(
          `[Gemini Fallback] Model '${model}' attempt ${attempt + 1} failed: ${err.message?.slice(0, 100)}`
        );

        if (isTransient && attempt < maxRetriesPerModel) {
          // Wait 800ms before retrying the same model
          await sleep(800);
        } else {
          // Switch to next model after short 300ms pause
          await sleep(300);
          break;
        }
      }
    }
  }

  // If every model in the fallback chain failed
  const userFriendlyMsg = cleanErrorMessage(lastError);
  const failureError = new Error(userFriendlyMsg);
  failureError.originalError = lastError;
  throw failureError;
}

module.exports = {
  ai,
  MODELS,
  callGeminiWithFallback,
  cleanErrorMessage,
};
