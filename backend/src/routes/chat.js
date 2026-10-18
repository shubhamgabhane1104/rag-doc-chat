const express = require('express');
const { v4: uuidv4 } = require('uuid');

const { pool } = require('../db/db');
const { requireAuth } = require('../middleware/auth');
const { embedText } = require('../services/embeddingService');
const vectorStore = require('../services/vectorStore');
const { generateAnswer, streamAnswer } = require('../services/llmService');
const { openStream } = require('../services/sse');
const { cleanErrorMessage } = require('../services/geminiClient');

const { uuidParams } = require('../middleware/validate');

const router = express.Router();
uuidParams(router, 'documentId');

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

/**
 * Validates the request, embeds the question and retrieves the best passages.
 * Returns { error, status } when the request can't be answered.
 */
async function prepareAnswer(req) {
  const { documentId } = req.params;
  const question = (req.body.question || '').trim();
  if (!question) return { status: 400, error: 'Question is required' };

  const docResult = await pool.query(
    'SELECT * FROM documents WHERE id = $1 AND user_id = $2',
    [documentId, req.userId]
  );
  const document = docResult.rows[0];
  if (!document) return { status: 404, error: 'Document not found' };
  if (document.status !== 'ready') {
    return { status: 400, error: `Document is not ready yet (status: ${document.status})` };
  }

  const t0 = Date.now();
  const queryVector = await embedText(question);
  const t1 = Date.now();
  const topChunks = vectorStore.search(documentId, queryVector, 4);
  console.log(`[Chat] embed ${t1 - t0} ms, search ${Date.now() - t1} ms`);

  const sources = topChunks.map((c) => ({
    pageNumber: c.pageNumber,
    snippet: c.text.slice(0, 200),
    relevanceScore: Math.round(c.score * 100) / 100,
  }));

  return { documentId, question, topChunks, sources };
}

async function saveExchange(userId, documentId, question, answer, sources) {
  const chat = await getOrCreateChat(userId, documentId);
  await pool.query(
    'INSERT INTO messages (id, chat_id, role, content) VALUES ($1, $2, $3, $4)',
    [uuidv4(), chat.id, 'user', question]
  );
  await pool.query(
    'INSERT INTO messages (id, chat_id, role, content, sources) VALUES ($1, $2, $3, $4, $5)',
    [uuidv4(), chat.id, 'assistant', answer, JSON.stringify(sources)]
  );
}

router.post('/:documentId/message', requireAuth, async (req, res) => {
  try {
    const prep = await prepareAnswer(req);
    if (prep.error) return res.status(prep.status).json({ error: prep.error });

    const answer = await generateAnswer(prep.question, prep.topChunks);
    await saveExchange(req.userId, prep.documentId, prep.question, answer, prep.sources);
    res.json({ answer, sources: prep.sources });
  } catch (err) {
    console.error('Chat message error:', err);
    res.status(500).json({ error: cleanErrorMessage(err) });
  }
});

/**
 * Streaming version: the answer appears word by word instead of after the
 * whole thing is generated. Sends Server-Sent Events (see services/sse.js).
 */
router.post('/:documentId/message/stream', requireAuth, async (req, res) => {
  let prep;
  try {
    prep = await prepareAnswer(req);
  } catch (err) {
    console.error('Chat stream prepare error:', err);
    return res.status(500).json({ error: cleanErrorMessage(err) });
  }
  if (prep.error) return res.status(prep.status).json({ error: prep.error });

  const stream = openStream(res);
  stream.send('sources', prep.sources);
  try {
    const answer = await streamAnswer(prep.question, prep.topChunks, (text) => stream.send('delta', { text }));
    await saveExchange(req.userId, prep.documentId, prep.question, answer, prep.sources);
    stream.send('done', { answer });
  } catch (err) {
    console.error('Chat stream error:', err);
    stream.send('error', { error: cleanErrorMessage(err) });
  } finally {
    stream.end();
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