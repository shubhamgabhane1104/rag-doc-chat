const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const EMBEDDING_MODEL = 'gemini-embedding-001';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function embedText(text, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await ai.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: text,
      });
      return response.embeddings[0].values;
    } catch (err) {
      if (attempt < retries) {
        console.warn(`[Embedding] Retry attempt ${attempt + 1} after error: ${err.message?.slice(0, 80)}`);
        await sleep(800 * (attempt + 1));
      } else {
        throw err;
      }
    }
  }
}

async function embedTexts(texts) {
  const vectors = [];
  for (const text of texts) {
    const vector = await embedText(text);
    vectors.push(vector);
  }
  return vectors;
}

module.exports = { embedText, embedTexts };