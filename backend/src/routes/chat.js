const express = require('express');
const { v4: uuidv4 } = require('uuid');

const { pool } = require('../db/db');
const { requireAuth } = require('../middleware/auth');
const { embedText } = require('../services/embeddingService');
const vectorStore = require('../services/vectorStore');
const { generateAnswer } = require('../services/llmService');

const router = express.Router();

async function getOrCreateChat(userId, documentId) {
  const existing = await pool.query(
    'SELECT * FROM chats WHERE user_id = $1 AND document_id = $2',
    [userId, documentId]
  );

  if (existing.rows.length > 0) return existing.rows[0];

  const chatId = uuidv4();
  await pool.query(
    'INSERT INTO chats (id, user_id, document_id) VALUES ($1, $2, $3)',
    [chatId, userId, documentId]
  );
  return { id: chatId, user_id: userId, document_id: documentId };
}

router.post('/:documentId/message', requireAuth, async (req, res) => {
  try {
    const { documentId } = req.params;
    const { question } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const docResult = await pool.query(
      'SELECT * FROM documents WHERE id = $1 AND user_id = $2',
      [documentId, req.userId]
    );
    const document = docResult.rows[0];

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    if (document.status !== 'ready') {
      return res.status(400).json({ error: `Document is not ready yet (status: ${document.status})` });
    }

    const queryVector = await embedText(question);
    const topChunks = vectorStore.search(documentId, queryVector, 4);
    const answer = await generateAnswer(question, topChunks);

    const sources = topChunks.map((c) => ({
      pageNumber: c.pageNumber,
      snippet: c.text.slice(0, 200),
      relevanceScore: Math.round(c.score * 100) / 100,
    }));

    const chat = await getOrCreateChat(req.userId, documentId);

    await pool.query(
      'INSERT INTO messages (id, chat_id, role, content) VALUES ($1, $2, $3, $4)',
      [uuidv4(), chat.id, 'user', question]
    );
    await pool.query(
      'INSERT INTO messages (id, chat_id, role, content, sources) VALUES ($1, $2, $3, $4, $5)',
      [uuidv4(), chat.id, 'assistant', answer, JSON.stringify(sources)]
    );

    res.json({ answer, sources });
  } catch (err) {
    console.error('Chat message error:', err);
    res.status(500).json({ error: 'Failed to generate an answer. Please try again.' });
  }
});

router.get('/:documentId/history', requireAuth, async (req, res) => {
  const { documentId } = req.params;

  const chatResult = await pool.query(
    'SELECT * FROM chats WHERE user_id = $1 AND document_id = $2',
    [req.userId, documentId]
  );

  if (chatResult.rows.length === 0) {
    return res.json({ messages: [] });
  }

  const messagesResult = await pool.query(
    'SELECT role, content, sources, created_at FROM messages WHERE chat_id = $1 ORDER BY created_at ASC',
    [chatResult.rows[0].id]
  );

  const messages = messagesResult.rows.map((m) => ({
    ...m,
    sources: m.sources ? JSON.parse(m.sources) : null,
  }));

  res.json({ messages });
});

module.exports = router;