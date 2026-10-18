const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const { pool } = require('../db/db');
const { requireAuth } = require('../middleware/auth');
const { extractTextByPage } = require('../services/documentService');
const { chunkPages } = require('../services/chunkService');
const { embedTexts } = require('../services/embeddingService');
const vectorStore = require('../services/vectorStore');
const { cleanErrorMessage } = require('../services/geminiClient');
const { uuidParams } = require('../middleware/validate');

const router = express.Router();
uuidParams(router, 'id');

const UPLOAD_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Browsers send multipart filenames as latin1; recover the real UTF-8 name.
function decodeOriginalName(name) {
  try {
    return Buffer.from(name, 'latin1').toString('utf8');
  } catch {
    return name;
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  // Never trust the client filename on disk; keep only the extension.
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname).toLowerCase()}`),
});

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.xlsx', '.xls', '.pptx', '.txt'];

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Check the extension, not the MIME type: browsers/OSes often report
    // .txt, .xls or .docx as application/octet-stream or an empty string.
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      const err = new Error('Unsupported file type. Allowed: PDF, DOCX, XLSX, XLS, PPTX, TXT');
      err.statusCode = 400;
      return cb(err);
    }
    cb(null, true);
  },
});

/**
 * Chunks overlap by ~200 chars, so naively joining them repeats text.
 * Find where the next chunk's start already appears at the end of the
 * previous one and only append the new part.
 */
function stitchChunks(texts) {
  let out = '';
  for (const text of texts) {
    if (!out) {
      out = text;
      continue;
    }
    const tail = out.slice(-400);
    let overlap = 0;
    for (let len = Math.min(tail.length, text.length); len >= 20; len--) {
      if (tail.endsWith(text.slice(0, len))) {
        overlap = len;
        break;
      }
    }
    if (!overlap) {
      // Chunks are trimmed, so the overlap may start mid-word; search for it.
      const probe = text.slice(0, 40);
      const idx = tail.lastIndexOf(probe);
      if (idx !== -1) overlap = tail.length - idx;
    }
    out += overlap ? text.slice(overlap) : ` ${text}`;
  }
  return out;
}

async function processDocument(documentId, filePath) {
  try {
    const pages = await extractTextByPage(filePath);
    const chunks = chunkPages(pages);

    if (chunks.length === 0) {
      await pool.query(
        'UPDATE documents SET status = $1, error_message = $2 WHERE id = $3',
        ['failed', 'No extractable text found in the document.', documentId]
      );
      return;
    }

    const vectors = await embedTexts(chunks.map((c) => c.text));

    const vectorEntries = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunkId = uuidv4();
      await pool.query(
        'INSERT INTO chunks (id, document_id, chunk_index, page_number, chunk_text) VALUES ($1, $2, $3, $4, $5)',
        [chunkId, documentId, i, chunks[i].pageNumber, chunks[i].text]
      );
      vectorEntries.push({
        chunkId,
        pageNumber: chunks[i].pageNumber,
        text: chunks[i].text,
        vector: vectors[i],
      });
    }

    vectorStore.saveVectors(documentId, vectorEntries);

    await pool.query(
      'UPDATE documents SET status = $1, page_count = $2, chunk_count = $3 WHERE id = $4',
      ['ready', pages.length, chunks.length, documentId]
    );

    console.log(`Document ${documentId} processed: ${chunks.length} chunks`);
  } catch (err) {
    console.error(`Processing failed for document ${documentId}:`, err);
    const friendlyError = cleanErrorMessage(err);
    await pool.query(
      'UPDATE documents SET status = $1, error_message = $2 WHERE id = $3',
      ['failed', friendlyError, documentId]
    );
  }
}

router.post('/:id/retry', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM documents WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    const doc = result.rows[0];

    if (!doc) return res.status(404).json({ error: 'Document not found' });
    if (!fs.existsSync(doc.file_path)) {
      return res.status(400).json({ error: 'Source file no longer exists. Please re-upload.' });
    }

    // Reset document state and clear old chunks/vectors
    await pool.query('DELETE FROM chunks WHERE document_id = $1', [doc.id]);
    vectorStore.deleteVectors(doc.id);
    await pool.query(
      'UPDATE documents SET status = $1, error_message = NULL WHERE id = $2',
      ['processing', doc.id]
    );

    processDocument(doc.id, doc.file_path);

    res.json({ message: 'Document reprocessing initiated', id: doc.id, status: 'processing' });
  } catch (err) {
    console.error('Retry failed:', err);
    res.status(500).json({ error: 'Failed to initiate reprocessing' });
  }
});

router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const documentId = uuidv4();
  const filename = decodeOriginalName(req.file.originalname);

  try {
    await pool.query(
      'INSERT INTO documents (id, user_id, filename, file_path, status) VALUES ($1, $2, $3, $4, $5)',
      [documentId, req.userId, filename, req.file.path, 'processing']
    );
  } catch (err) {
    fs.unlink(req.file.path, () => {});
    throw err;
  }

  processDocument(documentId, req.file.path); // runs in background, don't await

  res.status(202).json({ id: documentId, filename, status: 'processing' });
});

router.get('/', requireAuth, async (req, res) => {
  const result = await pool.query(
    'SELECT id, filename, status, page_count, chunk_count, error_message, created_at FROM documents WHERE user_id = $1 ORDER BY created_at DESC',
    [req.userId]
  );
  res.json(result.rows);
});

router.delete('/:id', requireAuth, async (req, res) => {
  const result = await pool.query(
    'SELECT * FROM documents WHERE id = $1 AND user_id = $2',
    [req.params.id, req.userId]
  );
  const doc = result.rows[0];

  if (!doc) return res.status(404).json({ error: 'Document not found' });

  if (fs.existsSync(doc.file_path)) fs.unlinkSync(doc.file_path);
  vectorStore.deleteVectors(doc.id);
  await pool.query('DELETE FROM documents WHERE id = $1', [doc.id]);

  res.json({ success: true });
});

router.get('/:id/content', requireAuth, async (req, res) => {
  const docResult = await pool.query(
    'SELECT * FROM documents WHERE id = $1 AND user_id = $2',
    [req.params.id, req.userId]
  );
  const doc = docResult.rows[0];

  if (!doc) return res.status(404).json({ error: 'Document not found' });
  if (doc.status !== 'ready') {
    return res.status(400).json({ error: 'Document is not ready yet' });
  }

  const chunksResult = await pool.query(
    'SELECT page_number, chunk_text FROM chunks WHERE document_id = $1 ORDER BY chunk_index ASC',
    [doc.id]
  );

  // Group chunks by page number
  const pageMap = {};
  for (const row of chunksResult.rows) {
    const pn = row.page_number || 1;
    if (!pageMap[pn]) pageMap[pn] = [];
    pageMap[pn].push(row.chunk_text);
  }

  const pages = Object.entries(pageMap)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([pageNumber, texts]) => ({
      pageNumber: Number(pageNumber),
      text: stitchChunks(texts),
    }));

  res.json({ filename: doc.filename, pages });
});

module.exports = router;