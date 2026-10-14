require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDb } = require('./src/db/db');
const authRoutes = require('./src/routes/auth');
const documentsRoutes = require('./src/routes/documents');
const chatRoutes = require('./src/routes/chat');
const quizRoutes = require('./src/routes/quiz');
const summariesRoutes = require('./src/routes/summaries');
const workspaceRoutes = require('./src/routes/workspaces');
const analyticsRoutes = require('./src/routes/analytics');

const app = express();

app.use(cors());
app.use(express.json());

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

const PORT = process.env.PORT || 5000;

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
  });