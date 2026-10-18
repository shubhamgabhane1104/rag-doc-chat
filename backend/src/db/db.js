const { Pool } = require('pg');

// gemini-embedding-001 returns 3072-dimensional vectors
const EMBEDDING_DIM = 3072;

// Either one connection string (what Neon, Supabase, Render give you)
// or the separate DB_* variables for a local PostgreSQL.
const databaseUrl = process.env.DATABASE_URL ? process.env.DATABASE_URL.trim() : '';
const useSsl = process.env.DB_SSL === 'true' || /[?&]sslmode=(require|verify-ca|verify-full|prefer)/.test(databaseUrl);

// SSL is configured here rather than through ?sslmode= in the URL (the pg
// driver warns that it will change how it reads that setting). Certificates
// are verified; set DB_SSL_REJECT_UNAUTHORIZED=false only for a host whose
// certificate your machine can't verify.
const ssl = useSsl ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined;

function withoutSslParams(url) {
  try {
    const u = new URL(url);
    ['sslmode', 'sslrootcert', 'uselibpqcompat'].forEach((k) => u.searchParams.delete(k));
    return u.toString();
  } catch {
    return url;
  }
}

const pool = new Pool(
  databaseUrl
    ? { connectionString: withoutSslParams(databaseUrl), ssl }
    : {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl,
      }
);

/** Turns common connection errors into a message that says what to fix. */
function explainConnectionError(err) {
  const where = databaseUrl ? 'DATABASE_URL in backend/.env' : 'the DB_* settings in backend/.env';
  const msg = err.message || '';
  if (err.code === '28P01' || /password authentication failed/i.test(msg)) {
    return `The database rejected the username or password. Check ${where}` +
      (databaseUrl ? ' (in Neon, click "Show password" before copying the connection string, so it contains the real password, not ********).' : '.');
  }
  if (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN') {
    return `Can't find the database host. Check the host name in ${where}, and your internet connection.`;
  }
  if (err.code === 'ECONNREFUSED') {
    return `Nothing is listening at the database address in ${where}. Is PostgreSQL running?`;
  }
  if (err.code === '3D000') {
    return `That database name doesn't exist. Check ${where}.`;
  }
  return msg;
}

async function enablePgvector() {
  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
  } catch (err) {
    const extensionMissing =
      err.code === '0A000' || // extension "vector" is not available (PG 15+)
      err.code === '58P01' || // could not open extension control file (PG 14 and older)
      /extension "vector"|vector\.control/i.test(err.message || '');
    const e = new Error(
      extensionMissing
        ? 'The pgvector extension is not installed in this PostgreSQL server. Easiest fix: use a free Neon ' +
            'or Supabase database (pgvector is built in) and put its connection string in DATABASE_URL. ' +
            'See README > "Running it locally".'
        : explainConnectionError(err)
    );
    e.cause = err;
    throw e;
  }
}

async function initDb() {
  await enablePgvector();

  await pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    auth_provider TEXT DEFAULT 'local',
    google_id TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'local';
  ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
  ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      file_path TEXT NOT NULL,
      status TEXT DEFAULT 'processing',
      page_count INTEGER DEFAULT 0,
      chunk_count INTEGER DEFAULT 0,
      error_message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chunks (
      id UUID PRIMARY KEY,
      document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      chunk_index INTEGER NOT NULL,
      page_number INTEGER,
      chunk_text TEXT NOT NULL,
      embedding vector(${EMBEDDING_DIM})
    );

    -- Databases created before the pgvector change get the column added here
    ALTER TABLE chunks ADD COLUMN IF NOT EXISTS embedding vector(${EMBEDDING_DIM});

    -- Search always filters by document first, so this index does the heavy lifting
    CREATE INDEX IF NOT EXISTS idx_chunks_document ON chunks(document_id, chunk_index);
    CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id, created_at DESC);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chats (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY,
      chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      sources TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS quizzes (
      id UUID PRIMARY KEY,
      document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      quiz_type TEXT NOT NULL CHECK (quiz_type IN ('mcq', 'viva')),
      title TEXT NOT NULL,
      difficulty TEXT DEFAULT 'medium',
      questions JSONB NOT NULL,
      user_answers JSONB,
      score INTEGER,
      total_questions INTEGER NOT NULL,
      completed BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_quizzes_doc_user ON quizzes(document_id, user_id);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS document_summaries (
      id UUID PRIMARY KEY,
      document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      executive_summary TEXT NOT NULL,
      key_takeaways JSONB NOT NULL,
      glossary JSONB,
      reading_time INTEGER DEFAULT 5,
      difficulty TEXT DEFAULT 'Intermediate',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_summaries_doc_user ON document_summaries(document_id, user_id);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS workspace_documents (
      workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (workspace_id, document_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS workspace_chats (
      id UUID PRIMARY KEY,
      workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT DEFAULT 'Workspace Chat',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS workspace_messages (
      id UUID PRIMARY KEY,
      chat_id UUID NOT NULL REFERENCES workspace_chats(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      sources TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_workspaces_user ON workspaces(user_id);
    CREATE INDEX IF NOT EXISTS idx_workspace_docs_ws ON workspace_documents(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_workspace_chats_ws ON workspace_chats(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_workspace_messages_chat ON workspace_messages(chat_id);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS document_knowledge_graphs (
      id UUID PRIMARY KEY,
      document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      central_topic TEXT NOT NULL,
      summary TEXT,
      nodes JSONB NOT NULL,
      edges JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_graph_doc_user ON document_knowledge_graphs(document_id, user_id);
  `);

  console.log('Database tables ready');
}

module.exports = { pool, initDb, EMBEDDING_DIM };