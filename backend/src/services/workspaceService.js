const { callGeminiWithFallback } = require('./geminiClient');

/**
 * Builds unified multi-document prompt
 */
function buildMultiDocPrompt(question, contextChunks, docMap) {
  const contextText = contextChunks
    .map((c, i) => {
      const docName = docMap[c.documentId] || 'Document';
      const pageNum = c.pageNumber || 1;
      return `[Source ${i + 1}: ${docName} · Page ${pageNum}]\n${c.text}`;
    })
    .join('\n\n');

  return `You are an elite research analyst and multi-document synthesis assistant.
Your task is to answer the user's question using ONLY the retrieved context passages from multiple documents below.

Guidelines:
1. Synthesize information across the different sources to give a complete, coherent answer.
2. When referencing facts, explicitly attribute them to the source document (e.g. "According to [Filename]...", "While [Filename] notes that...").
3. If the sources conflict or provide differing information, highlight and explain those differences clearly.
4. If the information is not present in any of the sources, say clearly: "I don't have enough information across the attached workspace documents to answer that."
5. Do not use outside knowledge.

Context from Workspace Documents:
${contextText}

Question: ${question}

Synthesized Multi-Document Answer:`;
}

/**
 * Generate answer across multiple workspace documents
 */
async function generateWorkspaceAnswer(question, topChunks, docMap) {
  const prompt = buildMultiDocPrompt(question, topChunks, docMap);

  const response = await callGeminiWithFallback({
    contents: prompt,
  });

  return response.text;
}

/**
 * Compare two documents side-by-side
 */
async function compareDocuments(docA, docB, comparisonType = 'differences') {
  const sampleA = (docA.chunks || []).slice(0, 10).map((c) => `[${docA.filename} p.${c.page_number || 1}]: ${c.chunk_text}`).join('\n\n');
  const sampleB = (docB.chunks || []).slice(0, 10).map((c) => `[${docB.filename} p.${c.page_number || 1}]: ${c.chunk_text}`).join('\n\n');

  let typeInstruction = '';
  if (comparisonType === 'commonground') {
    typeInstruction = 'Focus specifically on areas of agreement, shared principles, and common findings between the two documents.';
  } else if (comparisonType === 'matrix') {
    typeInstruction = 'Generate a detailed Markdown comparison table with columns: [Parameter / Feature | Document A Position | Document B Position | Analysis / Tradeoff].';
  } else {
    typeInstruction = 'Focus on key differences, modified specifications, conflicting approaches, and contrasting results between the two documents.';
  }

  const prompt = `You are a professional comparative analyst.
Compare and contrast the following two documents side-by-side.

${typeInstruction}

=== DOCUMENT A: ${docA.filename} ===
${sampleA}

=== DOCUMENT B: ${docB.filename} ===
${sampleB}

Structure your response with clear Markdown formatting:
1. **Executive Comparative Overview** (Concise paragraph summarizing the core relationship between both files)
2. **Comparison Matrix / Thematic Breakdown** (Categorized analysis with bullet points or table)
3. **Key Contrasts & Divergences** (Specific points where Document A and Document B differ)
4. **Summary & Recommendations**`;

  const response = await callGeminiWithFallback({
    contents: prompt,
  });

  return response.text;
}

module.exports = {
  generateWorkspaceAnswer,
  compareDocuments,
  callGeminiWithFallback,
};
