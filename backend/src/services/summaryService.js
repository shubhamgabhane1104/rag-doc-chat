const { callGeminiWithFallback } = require('./geminiClient');
const { parseJsonSafely } = require('./jsonUtils');

/** Runs fn over items with at most `limit` in flight; keeps result order. */
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Calls Gemini to generate the final structured summary
 */
async function generateFinalSummary(contextText, estimatedReadingTime) {
  const prompt = `You are an elite academic and professional document analyst.
Provide a comprehensive, high-quality, multi-level summary and analysis based strictly on the document context below.

Document Context:
${contextText}

Guidelines:
1. "executiveSummary": An articulate, cohesive paragraph (150-250 words) synthesizing the document's primary objectives, main arguments, methodology/architecture, and conclusions.
2. "difficulty": Choose one of ["Beginner", "Intermediate", "Advanced / Technical"].
3. "keyTakeaways": An array of 3 to 6 thematic sections. Each section must have a "topic" and an array of 2 to 4 detailed bullet "points" explaining specific findings, rules, architecture, or results.
4. "glossary": An array of 4 to 8 critical technical terms, domain acronyms, or concepts defined concisely based on how they appear in the document.
5. Return ONLY a valid JSON object matching the exact structure below without extra markdown fences outside the JSON.

Required JSON Structure:
{
  "executiveSummary": "Executive summary text here...",
  "difficulty": "Intermediate",
  "keyTakeaways": [
    {
      "topic": "Core Architecture",
      "points": [
        "Detail 1...",
        "Detail 2..."
      ]
    }
  ],
  "glossary": [
    {
      "term": "Term Name",
      "definition": "Definition based on the document..."
    }
  ]
}`;

  // One fallback chain only: every model in the chain supports JSON mode, so
  // re-running the whole chain without it just doubled the wait on failures.
  const response = await callGeminiWithFallback(
    { contents: prompt, config: { responseMimeType: 'application/json' } },
    { label: 'summary' }
  );

  let parsed = parseJsonSafely(response.text);
  if (Array.isArray(parsed)) parsed = parsed[0] || {};
  if (!parsed.executiveSummary) {
    throw new Error('The AI returned an incomplete summary. Please try again.');
  }
  return {
    ...parsed,
    keyTakeaways: Array.isArray(parsed.keyTakeaways) ? parsed.keyTakeaways : [],
    glossary: Array.isArray(parsed.glossary) ? parsed.glossary : [],
    readingTimeMinutes: estimatedReadingTime,
  };
}

/**
 * Map step for long documents: summarizes a batch of chunks into intermediate section notes
 */
async function summarizeBatch(batchChunks, batchIndex) {
  const batchText = batchChunks
    .map((c) => `[Page ${c.page_number || c.pageNumber || 1}]\n${c.chunk_text || c.text}`)
    .join('\n\n');

  const prompt = `Summarize the key facts, themes, technical terms, and arguments in this section of a larger document.
Keep the summary informative and dense (about 120-180 words):

${batchText}

Section Summary:`;

  const response = await callGeminiWithFallback(
    { contents: prompt },
    { label: `summary section ${batchIndex + 1}` }
  );

  return `[Section ${batchIndex + 1} Summary]:\n${response.text}`;
}

/**
 * Main summary generator supporting direct processing and Map-Reduce for large documents
 */
async function generateDocumentSummary(chunks) {
  if (!chunks || chunks.length === 0) {
    throw new Error('No text chunks found for this document.');
  }

  // Calculate approximate word count and estimated reading time
  const totalWords = chunks.reduce((acc, c) => {
    const text = c.chunk_text || c.text || '';
    return acc + text.split(/\s+/).filter(Boolean).length;
  }, 0);
  const estimatedReadingTime = Math.max(1, Math.round(totalWords / 200));

  // If document is small or moderate (<= 15 chunks), direct stuffing
  if (chunks.length <= 15) {
    const fullText = chunks
      .map((c, i) => `[Page ${c.page_number || c.pageNumber || 1} - Chunk ${i + 1}]\n${c.chunk_text || c.text}`)
      .join('\n\n');
    return await generateFinalSummary(fullText, estimatedReadingTime);
  }

  // For large documents (> 15 chunks): Map-Reduce Pipeline
  console.log(`Using Map-Reduce summarization for large document (${chunks.length} chunks)...`);
  const batchSize = 8;
  const batches = [];
  for (let i = 0; i < chunks.length; i += batchSize) {
    batches.push(chunks.slice(i, i + batchSize));
  }

  // Map step: summarise sections in parallel (a few at a time, to stay
  // under the free-tier rate limit) instead of one after another.
  const intermediateSummaries = await mapWithConcurrency(
    batches,
    Number(process.env.SUMMARY_CONCURRENCY) || 4,
    (batch, i) => summarizeBatch(batch, i)
  );

  // Reduce Step: combine intermediate summaries to produce final executive summary & insights
  const combinedContext = intermediateSummaries.join('\n\n');
  return await generateFinalSummary(combinedContext, estimatedReadingTime);
}

module.exports = {
  generateDocumentSummary,
};
