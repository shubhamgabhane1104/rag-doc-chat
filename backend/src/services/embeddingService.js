const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const EMBEDDING_MODEL = 'gemini-embedding-001';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Embeds a single text string with exponential backoff on 429 / 503
 */
async function embedText(text, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: text,
      });
      return response.embeddings[0].values;
    } catch (err) {
      const isRateLimit =
        err?.status === 429 ||
        err?.message?.includes('429') ||
        err?.message?.includes('RESOURCE_EXHAUSTED');
      const isTransient =
        isRateLimit ||
        err?.status === 503 ||
        err?.message?.includes('503') ||
        err?.message?.includes('high demand');

      if (isTransient && attempt < maxRetries) {
        const waitTime = isRateLimit ? (attempt + 1) * 3500 : 1200 * (attempt + 1);
        console.warn(
          `[Embedding] Retry attempt ${attempt + 1} after ${
            isRateLimit ? '429 Rate Limit' : '503 High Demand'
          }. Pausing ${waitTime}ms...`
        );
        await sleep(waitTime);
      } else {
        throw err;
      }
    }
  }
}

/**
 * Embeds an array of texts using batching and rate-limit pacing.
 * Batches up to 25 texts per API call (reducing total requests by ~95%),
 * preventing 429 RESOURCE_EXHAUSTED errors during multi-slide/page uploads.
 */
async function embedTexts(texts, batchSize = 25) {
  if (!texts || texts.length === 0) return [];

  const vectors = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const chunkBatch = texts.slice(i, i + batchSize);

    let batchSuccess = false;
    const maxRetries = 3;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await ai.models.embedContent({
          model: EMBEDDING_MODEL,
          contents: chunkBatch,
        });

        if (response.embeddings && response.embeddings.length > 0) {
          for (const item of response.embeddings) {
            vectors.push(item.values);
          }
          batchSuccess = true;
          break;
        } else {
          throw new Error('Empty embeddings returned from Gemini API.');
        }
      } catch (err) {
        const isRateLimit =
          err?.status === 429 ||
          err?.message?.includes('429') ||
          err?.message?.includes('RESOURCE_EXHAUSTED');
        const isTransient =
          isRateLimit ||
          err?.status === 503 ||
          err?.message?.includes('503') ||
          err?.message?.includes('high demand');

        if (isTransient && attempt < maxRetries) {
          const waitTime = isRateLimit ? (attempt + 1) * 4000 : 1500 * (attempt + 1);
          console.warn(
            `[Embedding Batch] Attempt ${attempt + 1} failed (${
              isRateLimit ? '429 Quota Rate Limit' : '503 Server Busy'
            }). Waiting ${waitTime}ms before retry...`
          );
          await sleep(waitTime);
        } else {
          throw err;
        }
      }
    }

    if (!batchSuccess) {
      throw new Error('Failed to embed batch of document chunks after retries.');
    }

    // Polite delay between batches if more than one batch exists to stay well within 15 RPM
    if (i + batchSize < texts.length) {
      await sleep(1000);
    }
  }

  return vectors;
}

module.exports = { embedText, embedTexts };