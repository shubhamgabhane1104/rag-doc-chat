const { callGeminiWithFallback, streamGeminiWithFallback } = require('./geminiClient');

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

  const response = await callGeminiWithFallback({ contents: prompt }, { label: 'chat answer' });
  return response.text;
}

/** Same as generateAnswer, but calls onText with each piece as it arrives. */
function streamAnswer(question, contextChunks, onText) {
  return streamGeminiWithFallback({ contents: buildPrompt(question, contextChunks) }, onText, {
    label: 'chat answer (stream)',
  });
}

module.exports = { generateAnswer, streamAnswer, buildPrompt };