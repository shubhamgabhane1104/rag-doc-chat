const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db/db');
const { requireAuth } = require('../middleware/auth');
const { embedText } = require('../services/embeddingService');
const vectorStore = require('../services/vectorStore');
const { generateWorkspaceAnswer, streamWorkspaceAnswer, compareDocuments } = require('../services/workspaceService');
const { openStream } = require('../services/sse');
const { cleanErrorMessage } = require('../services/geminiClient');

const { uuidParams, isUuid } = require('../middleware/validate');

const router = express.Router();
uuidParams(router, 'id');

/**
 * Helper to get or create a default chat session for a workspace
 */
async function getOrCreateWorkspaceChat(workspaceId, userId) {
  const existing = await pool.query(
    'SELECT * FROM workspace_chats WHERE workspace_id = $1 AND user_id = $2 ORDER BY created_at ASC LIMIT 1',
    [workspaceId, userId]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  const chatId = uuidv4();
  await pool.query(
    'INSERT INTO workspace_chats (id, workspace_id, user_id, title) VALUES ($1, $2, $3, $4)',
    [chatId, workspaceId, userId, 'Workspace Research Chat']
  );

  return { id: chatId, workspace_id: workspaceId, user_id: userId };
}

/**
 * List all workspaces for user with attached document stats
 * GET /workspaces
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT w.id, w.name, w.description, w.created_at,
              COALESCE(COUNT(wd.document_id), 0)::int AS document_count,
              COALESCE(
                json_agg(
                  json_build_object('id', d.id, 'filename', d.filename, 'pageCount', d.page_count)
                ) FILTER (WHERE d.id IS NOT NULL), 
                '[]'
              ) AS documents
       FROM workspaces w
       LEFT JOIN workspace_documents wd ON w.id = wd.workspace_id
       LEFT JOIN documents d ON wd.document_id = d.id
       WHERE w.user_id = $1
       GROUP BY w.id
       ORDER BY w.created_at DESC`,
      [req.userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('List workspaces error:', err);
    res.status(500).json({ error: 'Failed to retrieve workspaces' });
  }
});

/**
 * Create a new workspace
 * POST /workspaces
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, description = '', documentIds = [] } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Workspace name is required' });
    }

    const workspaceId = uuidv4();

    await pool.query(
      'INSERT INTO workspaces (id, user_id, name, description) VALUES ($1, $2, $3, $4)',
      [workspaceId, req.userId, name.trim(), description.trim()]
    );

    // Attach initial documents if provided
    let attached = 0;
    if (Array.isArray(documentIds) && documentIds.length > 0) {
      for (const docId of documentIds.filter(isUuid)) {
        // verify document belongs to user
        const docCheck = await pool.query(
          'SELECT id FROM documents WHERE id = $1 AND user_id = $2',
          [docId, req.userId]
        );
        if (docCheck.rows.length > 0) {
          const ins = await pool.query(
            'INSERT INTO workspace_documents (workspace_id, document_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [workspaceId, docId]
          );
          attached += ins.rowCount;
        }
      }
    }

    res.status(201).json({
      id: workspaceId,
      name: name.trim(),
      description: description.trim(),
      documentCount: attached,
    });
  } catch (err) {
    console.error('Create workspace error:', err);
    res.status(500).json({ error: 'Failed to create workspace' });
  }
});

/**
 * Get workspace details with attached documents
 * GET /workspaces/:id
 */
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const wsResult = await pool.query(
      'SELECT id, name, description, created_at FROM workspaces WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );
    const workspace = wsResult.rows[0];

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const docsResult = await pool.query(
      `SELECT d.id, d.filename, d.status, d.page_count, d.chunk_count, wd.added_at 
       FROM workspace_documents wd
       JOIN documents d ON wd.document_id = d.id
       WHERE wd.workspace_id = $1
       ORDER BY wd.added_at DESC`,
      [id]
    );

    res.json({
      ...workspace,
      documents: docsResult.rows,
    });
  } catch (err) {
    console.error('Get workspace error:', err);
    res.status(500).json({ error: 'Failed to retrieve workspace details' });
  }
});

/**
 * Update workspace name/description
 * PUT /workspaces/:id
 */
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description = '' } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Workspace name is required' });
    }

    const result = await pool.query(
      'UPDATE workspaces SET name = $1, description = $2 WHERE id = $3 AND user_id = $4 RETURNING *',
      [name.trim(), description.trim(), id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update workspace error:', err);
    res.status(500).json({ error: 'Failed to update workspace' });
  }
});

/**
 * Delete a workspace
 * DELETE /workspaces/:id
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM workspaces WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    res.json({ success: true, id });
  } catch (err) {
    console.error('Delete workspace error:', err);
    res.status(500).json({ error: 'Failed to delete workspace' });
  }
});

/**
 * Sync attached documents to workspace (add/remove)
 * POST /workspaces/:id/documents
 */
router.post('/:id/documents', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { documentIds } = req.body; // array of doc IDs

    if (!Array.isArray(documentIds)) {
      return res.status(400).json({ error: 'documentIds array is required' });
    }

    // Verify workspace belongs to user
    const wsCheck = await pool.query(
      'SELECT id FROM workspaces WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );
    if (wsCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Delete existing links for this workspace
    await pool.query('DELETE FROM workspace_documents WHERE workspace_id = $1', [id]);

    // Insert new links
    for (const docId of documentIds.filter(isUuid)) {
      const docCheck = await pool.query(
        'SELECT id FROM documents WHERE id = $1 AND user_id = $2',
        [docId, req.userId]
      );
      if (docCheck.rows.length > 0) {
        await pool.query(
          'INSERT INTO workspace_documents (workspace_id, document_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [id, docId]
        );
      }
    }

    // Return updated documents
    const updatedDocs = await pool.query(
      `SELECT d.id, d.filename, d.status, d.page_count, d.chunk_count 
       FROM workspace_documents wd
       JOIN documents d ON wd.document_id = d.id
       WHERE wd.workspace_id = $1`,
      [id]
    );

    res.json({ success: true, documents: updatedDocs.rows });
  } catch (err) {
    console.error('Sync documents error:', err);
    res.status(500).json({ error: 'Failed to update workspace documents' });
  }
});

/**
 * Validates the request and retrieves passages across the workspace's documents.
 * Returns { error, status } when the question can't be answered.
 */
async function prepareWorkspaceAnswer(req) {
  const { id } = req.params;
  const question = (req.body.question || '').trim();
  if (!question) return { status: 400, error: 'Question is required' };

  const wsResult = await pool.query(
    'SELECT id, name FROM workspaces WHERE id = $1 AND user_id = $2',
    [id, req.userId]
  );
  if (wsResult.rows.length === 0) return { status: 404, error: 'Workspace not found' };

  const docsResult = await pool.query(
    `SELECT d.id, d.filename, d.status
     FROM workspace_documents wd
     JOIN documents d ON wd.document_id = d.id
     WHERE wd.workspace_id = $1 AND d.status = 'ready'`,
    [id]
  );
  if (docsResult.rows.length === 0) {
    return {
      status: 400,
      error: 'No ready documents attached to this workspace. Please attach at least one ready document first.',
    };
  }

  const docMap = {};
  docsResult.rows.forEach((d) => {
    docMap[d.id] = d.filename;
  });

  const queryVector = await embedText(question);
  const topChunks = vectorStore.searchMultiDocs(Object.keys(docMap), queryVector, 6);
  if (topChunks.length === 0) {
    return { status: 400, error: 'No indexed text vectors found for the attached documents.' };
  }

  const sources = topChunks.map((c) => ({
    documentId: c.documentId,
    filename: docMap[c.documentId] || 'Document',
    pageNumber: c.pageNumber || 1,
    snippet: c.text ? c.text.slice(0, 200) : '',
    relevanceScore: Math.round(c.score * 100) / 100,
  }));

  return { workspaceId: id, question, topChunks, docMap, sources };
}

async function saveWorkspaceExchange(prep, userId, answer) {
  const chat = await getOrCreateWorkspaceChat(prep.workspaceId, userId);
  await pool.query(
    'INSERT INTO workspace_messages (id, chat_id, role, content) VALUES ($1, $2, $3, $4)',
    [uuidv4(), chat.id, 'user', prep.question]
  );
  await pool.query(
    'INSERT INTO workspace_messages (id, chat_id, role, content, sources) VALUES ($1, $2, $3, $4, $5)',
    [uuidv4(), chat.id, 'assistant', answer, JSON.stringify(prep.sources)]
  );
}

/**
 * Send a question across all workspace documents (cross-document RAG)
 * POST /workspaces/:id/message
 */
router.post('/:id/message', requireAuth, async (req, res) => {
  try {
    const prep = await prepareWorkspaceAnswer(req);
    if (prep.error) return res.status(prep.status).json({ error: prep.error });

    const answer = await generateWorkspaceAnswer(prep.question, prep.topChunks, prep.docMap);
    await saveWorkspaceExchange(prep, req.userId, answer);
    res.json({ answer, sources: prep.sources });
  } catch (err) {
    console.error('Workspace message error:', err);
    res.status(500).json({ error: cleanErrorMessage(err) });
  }
});

/**
 * Streaming version (Server-Sent Events, see services/sse.js)
 * POST /workspaces/:id/message/stream
 */
router.post('/:id/message/stream', requireAuth, async (req, res) => {
  let prep;
  try {
    prep = await prepareWorkspaceAnswer(req);
  } catch (err) {
    console.error('Workspace stream prepare error:', err);
    return res.status(500).json({ error: cleanErrorMessage(err) });
  }
  if (prep.error) return res.status(prep.status).json({ error: prep.error });

  const stream = openStream(res);
  stream.send('sources', prep.sources);
  try {
    const answer = await streamWorkspaceAnswer(prep.question, prep.topChunks, prep.docMap, (text) =>
      stream.send('delta', { text })
    );
    await saveWorkspaceExchange(prep, req.userId, answer);
    stream.send('done', { answer });
  } catch (err) {
    console.error('Workspace stream error:', err);
    stream.send('error', { error: cleanErrorMessage(err) });
  } finally {
    stream.end();
  }
});

/**
 * Get workspace chat history
 * GET /workspaces/:id/history
 */
router.get('/:id/history', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const chatResult = await pool.query(
      'SELECT id FROM workspace_chats WHERE workspace_id = $1 AND user_id = $2',
      [id, req.userId]
    );

    if (chatResult.rows.length === 0) {
      return res.json({ messages: [] });
    }

    const messagesResult = await pool.query(
      `SELECT id, role, content, sources, created_at 
       FROM workspace_messages 
       WHERE chat_id = $1 
       ORDER BY created_at ASC`,
      [chatResult.rows[0].id]
    );

    const messages = messagesResult.rows.map((m) => ({
      ...m,
      sources: m.sources ? JSON.parse(m.sources) : null,
    }));

    res.json({ messages });
  } catch (err) {
    console.error('Workspace history error:', err);
    res.status(500).json({ error: 'Failed to retrieve workspace chat history' });
  }
});

/**
 * Compare two documents side-by-side
 * POST /workspaces/:id/compare
 */
router.post('/:id/compare', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { docAId, docBId, comparisonType = 'differences' } = req.body;

    if (!isUuid(docAId) || !isUuid(docBId) || docAId === docBId) {
      return res.status(400).json({ error: 'Please select two different documents to compare.' });
    }

    // Verify both documents belong to user
    const docAResult = await pool.query(
      'SELECT id, filename, status FROM documents WHERE id = $1 AND user_id = $2',
      [docAId, req.userId]
    );
    const docBResult = await pool.query(
      'SELECT id, filename, status FROM documents WHERE id = $1 AND user_id = $2',
      [docBId, req.userId]
    );

    const docA = docAResult.rows[0];
    const docB = docBResult.rows[0];

    if (!docA || !docB) {
      return res.status(404).json({ error: 'One or both documents not found' });
    }

    // Fetch chunks for both documents
    const chunksAResult = await pool.query(
      'SELECT page_number, chunk_text FROM chunks WHERE document_id = $1 ORDER BY chunk_index ASC',
      [docAId]
    );
    const chunksBResult = await pool.query(
      'SELECT page_number, chunk_text FROM chunks WHERE document_id = $1 ORDER BY chunk_index ASC',
      [docBId]
    );

    const result = await compareDocuments(
      { filename: docA.filename, chunks: chunksAResult.rows },
      { filename: docB.filename, chunks: chunksBResult.rows },
      comparisonType
    );

    res.json({
      comparison: result,
      docA: docA.filename,
      docB: docB.filename,
      comparisonType,
    });
  } catch (err) {
    console.error('Compare documents error:', err);
    res.status(500).json({
      error: cleanErrorMessage(err),
    });
  }
});

module.exports = router;
