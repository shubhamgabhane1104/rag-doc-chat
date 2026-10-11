const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash'];

/**
 * Execute Gemini generateContent with automatic model fallback
 * (e.g. falls back to 3.6-flash if 3.8-flash is busy with 503)
 */
async function callGeminiWithFallback(options) {
  let lastError;

  for (const model of MODELS) {
    try {
      const res = await ai.models.generateContent({
        ...options,
        model,
      });
      return res;
    } catch (err) {
      lastError = err;
      console.warn(`Model ${model} returned error (${err.message}). Trying fallback...`);
    }
  }

  throw lastError;
}

/**
 * Safely parse JSON from LLM response, stripping markdown blocks if present.
 */
function parseJsonSafely(rawText) {
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '');
    cleaned = cleaned.replace(/\n?```$/, '');
  }
  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error(`Failed to parse AI summary output as JSON: ${err.message}`);
  }
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

  let response;
  try {
    response = await callGeminiWithFallback({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });
  } catch (err) {
    response = await callGeminiWithFallback({
      contents: prompt,
    });
  }

  const parsed = parseJsonSafely(response.text);
  return {
    ...parsed,
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

  const response = await callGeminiWithFallback({
    contents: prompt,
  });

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

  // Map Step: summarize each batch
  const intermediateSummaries = [];
  for (let i = 0; i < batches.length; i++) {
    const batchSummary = await summarizeBatch(batches[i], i);
    intermediateSummaries.push(batchSummary);
  }

  // Reduce Step: combine intermediate summaries to produce final executive summary & insights
  const combinedContext = intermediateSummaries.join('\n\n');
  return await generateFinalSummary(combinedContext, estimatedReadingTime);
}

module.exports = {
  generateDocumentSummary,
  parseJsonSafely,
  callGeminiWithFallback,
};
