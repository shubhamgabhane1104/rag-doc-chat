require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { initDb } = require('./src/db/db');
const { importLegacyVectorFiles } = require('./src/services/vectorStore');
const authRoutes = require('./src/routes/auth');
const documentsRoutes = require('./src/routes/documents');
const chatRoutes = require('./src/routes/chat');
const quizRoutes = require('./src/routes/quiz');
const summariesRoutes = require('./src/routes/summaries');
const workspaceRoutes = require('./src/routes/workspaces');
const analyticsRoutes = require('./src/routes/analytics');
const graphRoutes = require('./src/routes/graphs');

const missing = ['JWT_SECRET', 'GEMINI_API_KEY'].filter((k) => !process.env[k]);
if (!process.env.DATABASE_URL && !process.env.DB_NAME) missing.push('DATABASE_URL (or DB_NAME)');
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}. Add them to backend/.env`);
  process.exit(1);
}

const app = express();

// CORS_ORIGIN can be a comma-separated list; defaults to the Vite dev server.
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRoutes);
app.use('/documents', documentsRoutes);
app.use('/chats', chatRoutes);
app.use('/quiz', quizRoutes);
app.use('/summaries', summariesRoutes);
app.use('/workspaces', workspaceRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/graphs', graphRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Single place that turns thrown errors into JSON the frontend can show.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 20 MB).' : err.message;
    return res.status(400).json({ error: msg });
  }
  if (err.statusCode === 400) {
    return res.status(400).json({ error: err.message });
  }
  // Postgres: invalid UUID in a route param
  if (err.code === '22P02') {
    return res.status(404).json({ error: 'Not found' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON body' });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

const PORT = process.env.PORT || 5000;

initDb()
  .then(() => importLegacyVectorFiles())
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err.message);
    process.exit(1);
  });
