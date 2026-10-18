/**
 * Re-creates embeddings for any chunks that don't have one.
 *
 *   npm run reindex
 *
 * You normally don't need this: on startup the server copies vectors from the
 * old backend/data/vectors/*.json files into PostgreSQL automatically.
 * Use it if those files were lost, or after changing the embedding model.
 */
require('dotenv').config();
const { pool, initDb } = require('../src/db/db');
const { embedTexts } = require('../src/services/embeddingService');
const { importLegacyVectorFiles, toSqlVector } = require('../src/services/vectorStore');

async function main() {
  await initDb();
  await importLegacyVectorFiles();

  const missing = await pool.query(
    `SELECT c.id, c.chunk_text, d.filename
     FROM chunks c JOIN documents d ON d.id = c.document_id
     WHERE c.embedding IS NULL
     ORDER BY d.created_at, c.chunk_index`
  );
  if (missing.rows.length === 0) {
    console.log('Every chunk already has an embedding. Nothing to do.');
    return;
  }

  console.log(`Embedding ${missing.rows.length} chunks...`);
  const BATCH = 50;
  for (let i = 0; i < missing.rows.length; i += BATCH) {
    const rows = missing.rows.slice(i, i + BATCH);
    const vectors = await embedTexts(rows.map((r) => r.chunk_text));
    for (let j = 0; j < rows.length; j++) {
      await pool.query('UPDATE chunks SET embedding = $1::vector WHERE id = $2', [toSqlVector(vectors[j]), rows[j].id]);
    }
    console.log(`  ${Math.min(i + BATCH, missing.rows.length)} / ${missing.rows.length}`);
  }
  console.log('Done.');
}

main()
  .catch((err) => {
    console.error('Reindex failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
