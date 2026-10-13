const { callGeminiWithFallback } = require('./geminiClient');

function buildPrompt(question, contextChunks) {
  const contextText = contextChunks
    .map((c, i) => `[Chunk ${i + 1} - Page ${c.pageNumber}]\n${c.text}`)
    .join('\n\n');

  return `You are a helpful assistant answering questions about a document.
Use ONLY the context below to answer the question. Do not use outside knowledge.
If the answer is not present in the context, say clearly: "I don't have enough information in this document to answer that."

Context:
${contextText}

Question: ${question}

Answer:`;
}

async function generateAnswer(question, contextChunks) {
  const prompt = buildPrompt(question, contextChunks);

  const response = await callGeminiWithFallback({
    contents: prompt,
  });

  return response.text;
}

module.exports = { generateAnswer, buildPrompt };