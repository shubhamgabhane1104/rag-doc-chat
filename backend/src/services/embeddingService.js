const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const EMBEDDING_MODEL = 'gemini-embedding-001';

async function embedText(text) {
  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
  });
  return response.embeddings[0].values;
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