const { callGeminiWithFallback } = require('./geminiClient');

/**
 * Samples chunks evenly if the document has many chunks,
 * ensuring questions cover the entire document from start to end.
 */
function sampleChunks(chunks, maxChunks = 15) {
  if (!chunks || chunks.length <= maxChunks) {
    return chunks || [];
  }

  const sampled = [];
  const step = (chunks.length - 1) / (maxChunks - 1);

  for (let i = 0; i < maxChunks; i++) {
    const index = Math.round(i * step);
    sampled.push(chunks[index]);
  }

  return sampled;
}

/**
 * Clean LLM response to extract valid JSON
 */
function parseJsonSafely(rawText) {
  let cleaned = rawText.trim();
  // Strip ```json ... ``` or ``` ... ``` code blocks
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '');
    cleaned = cleaned.replace(/\n?```$/, '');
  }
  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    // If there is surrounding text, try extracting array with regex
    const match = cleaned.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error(`Failed to parse AI output as JSON: ${err.message}`);
  }
}

async function generateMcqQuestions(contextText, count = 5, difficulty = 'medium') {
  const prompt = `You are an academic examination expert. Create an interactive Multiple-Choice Quiz based SOLELY on the document context below.
Generate exactly ${count} multiple-choice questions at "${difficulty}" difficulty level.

Document Context:
${contextText}

Guidelines:
1. Every question must be directly answered by the document context.
2. Provide exactly 4 distinct and plausible options for each question.
3. "correctAnswer" MUST be the 0-based integer index of the correct option (0, 1, 2, or 3).
4. Provide a clear "explanation" explaining why the correct answer is right and why other options are incorrect.
5. Provide the "pageNumber" from the context where this answer is located.
6. Return ONLY a valid JSON array of objects. Do not include introductory or concluding conversational text.

Required JSON Structure:
[
  {
    "id": 1,
    "question": "What is the primary function of ...?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": 0,
    "explanation": "According to the document, ...",
    "pageNumber": 1
  }
]`;

  let response;
  try {
    response = await callGeminiWithFallback({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });
  } catch (err) {
    // Fallback without responseMimeType if not supported
    response = await callGeminiWithFallback({
      contents: prompt,
    });
  }

  return parseJsonSafely(response.text);
}

async function generateVivaQuestions(contextText, count = 5, difficulty = 'medium') {
  const prompt = `You are an experienced university professor and Viva Voce (oral examination) evaluator.
Based strictly on the document context below, generate exactly ${count} realistic Viva / Oral Exam questions at "${difficulty}" difficulty level.

Document Context:
${contextText}

Guidelines:
1. Viva questions must test conceptual clarity, architectural understanding, working mechanisms, trade-offs, and critical definitions.
2. "modelAnswer": Provide a concise, articulate oral answer (2-4 sentences) that an A-grade student should speak during the viva.
3. "keyPoints": Provide an array of 3 to 4 critical technical keywords, concepts, or terms that the student MUST mention while answering.
4. "pageNumber": The document page number where this concept appears.
5. Return ONLY a valid JSON array of objects. Do not include any markdown fences outside the JSON or conversational remarks.

Required JSON Structure:
[
  {
    "id": 1,
    "question": "Can you explain the difference between X and Y as stated in the document?",
    "modelAnswer": "X refers to ... while Y handles ... The primary distinction lies in ...",
    "keyPoints": ["Concept 1", "Architecture pattern", "Performance tradeoff"],
    "pageNumber": 1
  }
]`;

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

  return parseJsonSafely(response.text);
}

async function generateQuizFromChunks(chunks, { type = 'mcq', count = 5, difficulty = 'medium' }) {
  if (!chunks || chunks.length === 0) {
    throw new Error('No document content available to generate quiz questions.');
  }

  const sampled = sampleChunks(chunks, 15);
  const contextText = sampled
    .map((c, i) => `[Page ${c.page_number || c.pageNumber || 1} - Chunk ${i + 1}]\n${c.chunk_text || c.text}`)
    .join('\n\n');

  if (type === 'viva') {
    return await generateVivaQuestions(contextText, count, difficulty);
  }

  return await generateMcqQuestions(contextText, count, difficulty);
}

module.exports = {
  generateQuizFromChunks,
  sampleChunks,
  parseJsonSafely,
};
