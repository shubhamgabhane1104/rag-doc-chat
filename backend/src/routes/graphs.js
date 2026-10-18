const express = require('express');
const { pool } = require('../db/db');
const { requireAuth } = require('../middleware/auth');
const {
  generateKnowledgeGraph,
  getKnowledgeGraph,
  deleteKnowledgeGraph,
} = require('../services/graphService');
const { cleanErrorMessage } = require('../services/geminiClient');

const { uuidParams } = require('../middleware/validate');

const router = express.Router();
uuidParams(router, 'documentId');

/**
 * Get cached Knowledge Graph for a document
 * GET /graphs/:documentId
 */
router.get('/:documentId', requireAuth, async (req, res) => {
  try {
    const { documentId } = req.params;

    // Verify document belongs to user
    const docCheck = await pool.query(
      'SELECT id, filename, status FROM documents WHERE id = $1 AND user_id = $2',
      [documentId, req.userId]
    );

    if (docCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const graph = await getKnowledgeGraph(documentId, req.userId);

    res.json({
      cached: !!graph,
      document: docCheck.rows[0],
      graph,
    });
  } catch (err) {
    console.error('Get knowledge graph error:', err);
    res.status(500).json({ error: 'Failed to retrieve knowledge graph.' });
  }
});

/**
 * Generate or Regenerate Knowledge Graph
 * POST /graphs/:documentId/generate
 */
router.post('/:documentId/generate', requireAuth, async (req, res) => {
  try {
    const { documentId } = req.params;

    // Verify document belongs to user and is ready
    const docCheck = await pool.query(
      'SELECT id, filename, status FROM documents WHERE id = $1 AND user_id = $2',
      [documentId, req.userId]
    );

    if (docCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const doc = docCheck.rows[0];
    if (doc.status !== 'ready') {
      return res.status(400).json({ error: `Document is not ready (status: ${doc.status})` });
    }

    const graph = await generateKnowledgeGraph(documentId, req.userId);

    res.json({
      success: true,
      document: doc,
      graph,
    });
  } catch (err) {
    console.error('Generate knowledge graph error:', err);
    res.status(500).json({
      error: cleanErrorMessage(err),
    });
  }
});

/**
 * Delete cached graph
 * DELETE /graphs/:documentId
 */
router.delete('/:documentId', requireAuth, async (req, res) => {
  try {
    const { documentId } = req.params;
    await deleteKnowledgeGraph(documentId, req.userId);
    res.json({ success: true, message: 'Knowledge graph deleted.' });
  } catch (err) {
    console.error('Delete knowledge graph error:', err);
    res.status(500).json({ error: 'Failed to delete knowledge graph.' });
  }
});

module.exports = router;
