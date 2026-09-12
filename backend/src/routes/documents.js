const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const { pool } = require('../db/db');
const { requireAuth } = require('../middleware/auth');
const { extractTextByPage } = require('../services/pdfService');
const { chunkPages } = require('../services/chunkService');
const { embedTexts } = require('../services/embeddingService');
const vectorStore = require('../services/vectorStore');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `${uuidv4()}-${file.originalname}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDF files are supported'));
    }
    cb(null, true);
  },
});

async function processDocument(documentId, filePath) {
  try {
    const pages = await extractTextByPage(filePath);
    const chunks = chunkPages(pages);

    if (chunks.length === 0) {
      await pool.query(
        'UPDATE documents SET status = $1, error_message = $2 WHERE id = $3',
        ['failed', 'No extractable text found (may be a scanned image PDF).', documentId]
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
    await pool.query(
      'UPDATE documents SET status = $1, error_message = $2 WHERE id = $3',
      ['failed', err.message || 'Unknown error', documentId]
    );
  }
}

router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const documentId = uuidv4();

  await pool.query(
    'INSERT INTO documents (id, user_id, filename, file_path, status) VALUES ($1, $2, $3, $4, $5)',
    [documentId, req.userId, req.file.originalname, req.file.path, 'processing']
  );

  processDocument(documentId, req.file.path); // runs in background, don't await

  res.status(202).json({ id: documentId, filename: req.file.originalname, status: 'processing' });
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

module.exports = router;