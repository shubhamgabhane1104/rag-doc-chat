const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db/db');
const { requireAuth } = require('../middleware/auth');
const { generateDocumentSummary } = require('../services/summaryService');

const router = express.Router();

/**
 * Fetch cached summary for a document
 * GET /summaries/:documentId
 */
router.get('/:documentId', requireAuth, async (req, res) => {
  try {
    const { documentId } = req.params;

    // Check document ownership
    const docResult = await pool.query(
      'SELECT id, filename, status FROM documents WHERE id = $1 AND user_id = $2',
      [documentId, req.userId]
    );
    const document = docResult.rows[0];

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const summaryResult = await pool.query(
      `SELECT id, document_id, executive_summary, key_takeaways, glossary, reading_time, difficulty, created_at 
       FROM document_summaries 
       WHERE document_id = $1 AND user_id = $2 
       ORDER BY created_at DESC LIMIT 1`,
      [documentId, req.userId]
    );

    if (summaryResult.rows.length === 0) {
      return res.json({ cached: false, summary: null });
    }

    const row = summaryResult.rows[0];
    res.json({
      cached: true,
      summary: {
        id: row.id,
        documentId: row.document_id,
        filename: document.filename,
        executiveSummary: row.executive_summary,
        keyTakeaways: row.key_takeaways,
        glossary: row.glossary,
        readingTimeMinutes: row.reading_time,
        difficulty: row.difficulty,
        createdAt: row.created_at,
      },
    });
  } catch (err) {
    console.error('Fetch summary error:', err);
    res.status(500).json({ error: 'Failed to retrieve document summary' });
  }
});

/**
 * Generate (or force regenerate) a summary for a document
 * POST /summaries/:documentId
 */
router.post('/:documentId', requireAuth, async (req, res) => {
  try {
    const { documentId } = req.params;
    const { force = false } = req.body;

    // Verify document exists, belongs to user, and is ready
    const docResult = await pool.query(
      'SELECT id, filename, status FROM documents WHERE id = $1 AND user_id = $2',
      [documentId, req.userId]
    );
    const document = docResult.rows[0];

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    if (document.status !== 'ready') {
      return res.status(400).json({ error: `Document is not ready yet (status: ${document.status})` });
    }

    // Check if cached summary already exists and force is false
    if (!force) {
      const existing = await pool.query(
        `SELECT id, document_id, executive_summary, key_takeaways, glossary, reading_time, difficulty, created_at 
         FROM document_summaries 
         WHERE document_id = $1 AND user_id = $2 
         ORDER BY created_at DESC LIMIT 1`,
        [documentId, req.userId]
      );

      if (existing.rows.length > 0) {
        const row = existing.rows[0];
        return res.json({
          cached: true,
          summary: {
            id: row.id,
            documentId: row.document_id,
            filename: document.filename,
            executiveSummary: row.executive_summary,
            keyTakeaways: row.key_takeaways,
            glossary: row.glossary,
            readingTimeMinutes: row.reading_time,
            difficulty: row.difficulty,
            createdAt: row.created_at,
          },
        });
      }
    }

    // Fetch document chunks
    const chunksResult = await pool.query(
      'SELECT page_number, chunk_text FROM chunks WHERE document_id = $1 ORDER BY chunk_index ASC',
      [documentId]
    );

    if (chunksResult.rows.length === 0) {
      return res.status(400).json({ error: 'No text chunks available to generate summary.' });
    }

    // Generate summary with Gemini
    const result = await generateDocumentSummary(chunksResult.rows);

    const summaryId = uuidv4();

    // Remove older summary for this doc & user, then insert fresh
    await pool.query(
      'DELETE FROM document_summaries WHERE document_id = $1 AND user_id = $2',
      [documentId, req.userId]
    );

    await pool.query(
      `INSERT INTO document_summaries 
       (id, document_id, user_id, executive_summary, key_takeaways, glossary, reading_time, difficulty) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        summaryId,
        documentId,
        req.userId,
        result.executiveSummary,
        JSON.stringify(result.keyTakeaways || []),
        JSON.stringify(result.glossary || []),
        result.readingTimeMinutes || 5,
        result.difficulty || 'Intermediate',
      ]
    );

    res.status(201).json({
      cached: false,
      summary: {
        id: summaryId,
        documentId,
        filename: document.filename,
        executiveSummary: result.executiveSummary,
        keyTakeaways: result.keyTakeaways,
        glossary: result.glossary,
        readingTimeMinutes: result.readingTimeMinutes,
        difficulty: result.difficulty,
      },
    });
  } catch (err) {
    console.error('Summary generation error:', err);
    res.status(500).json({
      error: err.message || 'Failed to generate summary. Please try again.',
    });
  }
});

/**
 * Delete a cached summary
 * DELETE /summaries/:documentId
 */
router.delete('/:documentId', requireAuth, async (req, res) => {
  try {
    const { documentId } = req.params;

    await pool.query(
      'DELETE FROM document_summaries WHERE document_id = $1 AND user_id = $2',
      [documentId, req.userId]
    );

    res.json({ success: true, message: 'Summary cache cleared' });
  } catch (err) {
    console.error('Delete summary error:', err);
    res.status(500).json({ error: 'Failed to delete summary cache' });
  }
});

module.exports = router;
