const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db/db');
const { generateDocumentSummary } = require('./summaryService');

// Summaries being written right now, so a click on "Summary" while the
// background job is still running waits for it instead of starting a second one.
const inFlight = new Map();

/** Generates a summary with Gemini and saves it (replacing any older one). */
function createSummary(documentId, userId) {
  const key = `${documentId}:${userId}`;
  if (inFlight.has(key)) return inFlight.get(key);

  const job = (async () => {
    const chunksResult = await pool.query(
      'SELECT page_number, chunk_text FROM chunks WHERE document_id = $1 ORDER BY chunk_index ASC',
      [documentId]
    );
    if (chunksResult.rows.length === 0) {
      const e = new Error('No text chunks available to generate summary.');
      e.statusCode = 400;
      throw e;
    }

    const result = await generateDocumentSummary(chunksResult.rows);
    const summaryId = uuidv4();

    await pool.query('DELETE FROM document_summaries WHERE document_id = $1 AND user_id = $2', [documentId, userId]);
    await pool.query(
      `INSERT INTO document_summaries
       (id, document_id, user_id, executive_summary, key_takeaways, glossary, reading_time, difficulty)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        summaryId,
        documentId,
        userId,
        result.executiveSummary,
        JSON.stringify(result.keyTakeaways || []),
        JSON.stringify(result.glossary || []),
        result.readingTimeMinutes || 5,
        result.difficulty || 'Intermediate',
      ]
    );
    return { summaryId, result };
  })();

  inFlight.set(key, job);
  job.finally(() => inFlight.delete(key)).catch(() => {});
  return job;
}

/**
 * Called when a document becomes ready: writes its summary in the background,
 * so opening "Summary" later is instant instead of waiting for the AI.
 * Skipped for very long documents (they need many AI calls) and when
 * AUTO_SUMMARY=false. Errors are only logged; the user can still click Summary.
 */
function prepareSummaryInBackground(documentId, userId, chunkCount) {
  if (process.env.AUTO_SUMMARY === 'false') return;
  const maxChunks = Number(process.env.AUTO_SUMMARY_MAX_CHUNKS) || 120;
  if (chunkCount > maxChunks) return;
  createSummary(documentId, userId)
    .then(() => console.log(`Summary prepared in background for document ${documentId}`))
    .catch((err) => console.warn(`Background summary skipped for ${documentId}: ${err.message}`));
}

module.exports = { createSummary, prepareSummaryInBackground };
