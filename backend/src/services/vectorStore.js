/**
 * Vector store backed by PostgreSQL + pgvector.
 *
 * Each row of `chunks` holds a passage of text AND its embedding
 * (`embedding vector(3072)`), so text, metadata and vectors live in one
 * database, are deleted together (ON DELETE CASCADE) and are searched with SQL.
 *
 * Search strategy: first narrow down to the chunks of the document(s) being
 * asked about (indexed by document_id), then rank them by exact cosine
 * distance (`<=>`). For one user's documents that's a few hundred to a few
 * thousand rows, which Postgres ranks in milliseconds, and the results are
 * exact. (An approximate HNSW index combined with a WHERE filter can silently
 * return fewer than k rows on pgvector < 0.8, so we don't rely on one here.)
 */
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { pool, EMBEDDING_DIM } = require('../db/db');

/** pgvector accepts vectors as text like "[0.1,0.2,...]". */
const toSqlVector = (values) => `[${values.join(',')}]`;

/**
 * Inserts a document's chunks together with their embeddings.
 * Uses multi-row inserts (UNNEST) in batches instead of one query per chunk.
 */
async function saveChunks(documentId, chunks, vectors) {
  const BATCH = 100;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (let start = 0; start < chunks.length; start += BATCH) {
      const slice = chunks.slice(start, start + BATCH);
      const ids = [];
      const indexes = [];
      const pages = [];
      const texts = [];
      const embeddings = [];
      slice.forEach((chunk, i) => {
        const vec = vectors[start + i];
        if (!vec || vec.length !== EMBEDDING_DIM) {
          throw new Error(`Embedding ${start + i} has ${vec?.length || 0} dimensions, expected ${EMBEDDING_DIM}`);
        }
        ids.push(uuidv4());
        indexes.push(start + i);
        pages.push(chunk.pageNumber);
        texts.push(chunk.text);
        embeddings.push(toSqlVector(vec));
      });
      await client.query(
        `INSERT INTO chunks (id, document_id, chunk_index, page_number, chunk_text, embedding)
         SELECT u.id, $1, u.idx, u.page, u.txt, u.emb::vector
         FROM unnest($2::uuid[], $3::int[], $4::int[], $5::text[], $6::text[])
           AS u(id, idx, page, txt, emb)`,
        [documentId, ids, indexes, pages, texts, embeddings]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Returns the topK most similar chunks across the given documents.
 * score = cosine similarity (1 = identical direction, 0 = unrelated).
 */
async function search(documentIds, queryVector, topK = 4) {
  const ids = Array.isArray(documentIds) ? documentIds : [documentIds];
  if (ids.length === 0) return [];

  const result = await pool.query(
    `WITH candidates AS MATERIALIZED (
       SELECT id, document_id, page_number, chunk_text, embedding
       FROM chunks
       WHERE document_id = ANY($2::uuid[]) AND embedding IS NOT NULL
     )
     SELECT id, document_id, page_number, chunk_text,
            1 - (embedding <=> $1::vector) AS score
     FROM candidates
     ORDER BY embedding <=> $1::vector
     LIMIT $3`,
    [toSqlVector(queryVector), ids, topK]
  );

  return result.rows.map((r) => ({
    chunkId: r.id,
    documentId: r.document_id,
    pageNumber: r.page_number,
    text: r.chunk_text,
    score: Number(r.score),
  }));
}

/** Numbers for the Analytics page. */
async function getVectorStoreStats() {
  const result = await pool.query(
    `SELECT COUNT(DISTINCT document_id) FILTER (WHERE embedding IS NOT NULL) AS docs,
            COUNT(embedding) AS vectors,
            pg_total_relation_size('chunks') AS bytes
     FROM chunks`
  );
  const row = result.rows[0];
  const bytes = Number(row.bytes) || 0;
  return {
    engine: 'PostgreSQL + pgvector',
    totalDocumentsIndexed: Number(row.docs) || 0,
    totalVectors: Number(row.vectors) || 0,
    storageBytes: bytes,
    storagePretty: bytes > 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(2)} MB` : `${(bytes / 1024).toFixed(1)} KB`,
    dimension: EMBEDDING_DIM,
  };
}

/**
 * One-time migration: earlier versions stored vectors in
 * backend/data/vectors/<documentId>.json. Copy any of those into the
 * `embedding` column for chunks that don't have one yet. Safe to run on
 * every start; it does nothing once everything is imported.
 */
async function importLegacyVectorFiles() {
  const dir = path.join(__dirname, '../../data/vectors');
  if (!fs.existsSync(dir)) return 0;

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  if (files.length === 0) return 0;

  // One query: which of these documents exist in THIS database and still have
  // chunks without an embedding? Files for other databases (e.g. an old local
  // one after switching to Neon) are skipped without reading them.
  const documentIds = files.map((f) => f.replace(/\.json$/, '')).filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  const pending = await pool.query(
    'SELECT DISTINCT document_id FROM chunks WHERE document_id = ANY($1::uuid[]) AND embedding IS NULL',
    [documentIds]
  );
  if (pending.rows.length === 0) return 0;

  let imported = 0;
  for (const { document_id: documentId } of pending.rows) {
    let entries;
    try {
      entries = JSON.parse(fs.readFileSync(path.join(dir, `${documentId}.json`), 'utf-8'));
    } catch {
      continue;
    }
    const usable = entries.filter(
      (e) => e.chunkId && Array.isArray(e.vector) && e.vector.length === EMBEDDING_DIM
    );
    // Batch update: one round trip per 100 chunks instead of one per chunk
    for (let i = 0; i < usable.length; i += 100) {
      const batch = usable.slice(i, i + 100);
      const res = await pool.query(
        `UPDATE chunks c SET embedding = u.emb::vector
         FROM unnest($1::uuid[], $2::text[]) AS u(id, emb)
         WHERE c.id = u.id AND c.embedding IS NULL`,
        [batch.map((e) => e.chunkId), batch.map((e) => toSqlVector(e.vector))]
      );
      imported += res.rowCount;
    }
  }
  if (imported > 0) console.log(`Imported ${imported} embeddings from data/vectors into PostgreSQL`);
  return imported;
}

module.exports = { saveChunks, search, getVectorStoreStats, importLegacyVectorFiles, toSqlVector };
