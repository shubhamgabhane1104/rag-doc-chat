const { pool } = require('../db/db');
const { getVectorStoreStats } = require('./vectorStore');
const { MODELS, getAverageLatencyMs } = require('./geminiClient');

/**
 * Gathers high-level telemetry and KPI metrics for a specific user
 */
async function getOverviewMetrics(userId) {
  // 1. Documents & Chunks aggregate
  const docStats = await pool.query(
    `SELECT 
       COUNT(*) as total_documents,
       COUNT(*) FILTER (WHERE status = 'ready') as ready_documents,
       COALESCE(SUM(page_count), 0) as total_pages,
       COALESCE(SUM(chunk_count), 0) as total_chunks
     FROM documents 
     WHERE user_id = $1`,
    [userId]
  );

  // 2. Single-doc Chat queries count
  const chatQueries = await pool.query(
    `SELECT COUNT(m.id) as count
     FROM messages m
     JOIN chats c ON m.chat_id = c.id
     WHERE c.user_id = $1 AND m.role = 'user'`,
    [userId]
  );

  // 3. Workspace Chat queries count
  const workspaceQueries = await pool.query(
    `SELECT COUNT(wm.id) as count
     FROM workspace_messages wm
     JOIN workspace_chats wc ON wm.chat_id = wc.id
     WHERE wc.user_id = $1 AND wm.role = 'user'`,
    [userId]
  );

  // 4. Quizzes & Performance
  const quizStats = await pool.query(
    `SELECT 
       COUNT(*) as total_quizzes,
       COUNT(*) FILTER (WHERE completed = true) as completed_quizzes,
       COALESCE(ROUND(AVG(score::numeric / NULLIF(total_questions, 0) * 100)), 0) as avg_score
     FROM quizzes
     WHERE user_id = $1`,
    [userId]
  );

  // 5. Workspaces & Summaries count
  const wsCount = await pool.query(
    `SELECT COUNT(*) as count FROM workspaces WHERE user_id = $1`,
    [userId]
  );
  const sumCount = await pool.query(
    `SELECT COUNT(*) as count FROM document_summaries WHERE user_id = $1`,
    [userId]
  );

  const totalDocs = parseInt(docStats.rows[0].total_documents, 10) || 0;
  const readyDocs = parseInt(docStats.rows[0].ready_documents, 10) || 0;
  const totalPages = parseInt(docStats.rows[0].total_pages, 10) || 0;
  const totalChunks = parseInt(docStats.rows[0].total_chunks, 10) || 0;

  const singleQueries = parseInt(chatQueries.rows[0].count, 10) || 0;
  const wsQueries = parseInt(workspaceQueries.rows[0].count, 10) || 0;
  const totalQueries = singleQueries + wsQueries;

  const totalQuizzes = parseInt(quizStats.rows[0].total_quizzes, 10) || 0;
  const completedQuizzes = parseInt(quizStats.rows[0].completed_quizzes, 10) || 0;
  const avgQuizScore = parseInt(quizStats.rows[0].avg_score, 10) || 0;

  const totalWorkspaces = parseInt(wsCount.rows[0].count, 10) || 0;
  const totalSummaries = parseInt(sumCount.rows[0].count, 10) || 0;

  // 6. RAG Token & Cost Efficiency Estimates
  // Average ~125 tokens per chunk * 4 retrieved chunks + 15 question tokens + 220 answer tokens = ~735 tokens/query
  const estimatedTokensUsed = totalQueries * 735;
  // If no RAG was used, stuffing whole documents would require ~500 tokens per page * totalPages per query
  const estimatedTokensWithoutRag = totalQueries * Math.max(totalPages * 450, 1500);
  const tokenSavingsPercent = estimatedTokensWithoutRag > 0
    ? Math.max(0, Math.round(((estimatedTokensWithoutRag - estimatedTokensUsed) / estimatedTokensWithoutRag) * 100))
    : 0;

  return {
    documents: {
      total: totalDocs,
      ready: readyDocs,
      pages: totalPages,
      chunks: totalChunks,
    },
    activity: {
      totalQueries,
      singleDocQueries: singleQueries,
      workspaceQueries: wsQueries,
      totalWorkspaces,
      totalSummaries,
    },
    quizPerformance: {
      total: totalQuizzes,
      completed: completedQuizzes,
      averageScorePercent: avgQuizScore,
    },
    ragEconomics: {
      estimatedTokensUsed,
      estimatedTokensWithoutRag,
      tokenSavingsPercent,
      // Measured from real Gemini calls since the server started; null until the first one.
      avgLatencyMs: getAverageLatencyMs(),
    },
  };
}

/**
 * Returns daily query activity and document uploads for past N days
 */
async function getActivityTrends(userId, days = 7) {
  // Generate date series for past N days
  const trendsResult = await pool.query(
    `WITH dates AS (
       SELECT (CURRENT_DATE - i * INTERVAL '1 day')::date AS day
       FROM generate_series(0, $2 - 1) AS i
     ),
     single_queries AS (
       SELECT m.created_at::date as day, COUNT(*) as count
       FROM messages m
       JOIN chats c ON m.chat_id = c.id
       WHERE c.user_id = $1 AND m.role = 'user'
       GROUP BY m.created_at::date
     ),
     ws_queries AS (
       SELECT wm.created_at::date as day, COUNT(*) as count
       FROM workspace_messages wm
       JOIN workspace_chats wc ON wm.chat_id = wc.id
       WHERE wc.user_id = $1 AND wm.role = 'user'
       GROUP BY wm.created_at::date
     ),
     uploads AS (
       SELECT created_at::date as day, COUNT(*) as count
       FROM documents
       WHERE user_id = $1
       GROUP BY created_at::date
     )
     SELECT 
       d.day,
       TO_CHAR(d.day, 'Mon DD') as label,
       COALESCE(sq.count, 0) + COALESCE(wq.count, 0) as queries,
       COALESCE(u.count, 0) as uploads
     FROM dates d
     LEFT JOIN single_queries sq ON d.day = sq.day
     LEFT JOIN ws_queries wq ON d.day = wq.day
     LEFT JOIN uploads u ON d.day = u.day
     ORDER BY d.day ASC`,
    [userId, days]
  );

  return trendsResult.rows.map((row) => ({
    date: row.day,
    label: row.label,
    queries: parseInt(row.queries, 10) || 0,
    uploads: parseInt(row.uploads, 10) || 0,
  }));
}

/**
 * Detailed breakdown of documents, leaderboard, and file format distribution
 */
async function getDocumentAnalytics(userId) {
  // 1. Leaderboard: Top queried documents
  const leaderboardResult = await pool.query(
    `SELECT 
       d.id, 
       d.filename, 
       d.page_count, 
       d.chunk_count, 
       d.status,
       d.created_at,
       COUNT(m.id) FILTER (WHERE m.role = 'user') as query_count,
       COUNT(m.id) FILTER (WHERE m.role = 'assistant' AND m.sources IS NOT NULL) as citation_count
     FROM documents d
     LEFT JOIN chats c ON d.id = c.document_id AND c.user_id = d.user_id
     LEFT JOIN messages m ON c.id = m.chat_id
     WHERE d.user_id = $1
     GROUP BY d.id, d.filename, d.page_count, d.chunk_count, d.status, d.created_at
     ORDER BY query_count DESC, d.created_at DESC
     LIMIT 8`,
    [userId]
  );

  // 2. File formats distribution
  const allDocs = await pool.query(
    `SELECT filename FROM documents WHERE user_id = $1`,
    [userId]
  );

  const formatCounts = { PDF: 0, TXT: 0, DOCX: 0, MD: 0, Other: 0 };
  for (const doc of allDocs.rows) {
    const ext = (doc.filename.split('.').pop() || '').toUpperCase();
    if (ext === 'PDF') formatCounts.PDF++;
    else if (ext === 'TXT') formatCounts.TXT++;
    else if (ext === 'DOCX' || ext === 'DOC') formatCounts.DOCX++;
    else if (ext === 'MD') formatCounts.MD++;
    else formatCounts.Other++;
  }

  // 3. Quiz Score Distribution
  const quizzes = await pool.query(
    `SELECT score, total_questions FROM quizzes WHERE user_id = $1 AND completed = true`,
    [userId]
  );
  let high = 0, medium = 0, low = 0;
  for (const q of quizzes.rows) {
    const pct = q.total_questions > 0 ? (q.score / q.total_questions) * 100 : 0;
    if (pct >= 80) high++;
    else if (pct >= 50) medium++;
    else low++;
  }

  return {
    leaderboard: leaderboardResult.rows.map((r) => ({
      id: r.id,
      filename: r.filename,
      pageCount: r.page_count,
      chunkCount: r.chunk_count,
      status: r.status,
      createdAt: r.created_at,
      queryCount: parseInt(r.query_count, 10) || 0,
      citationCount: parseInt(r.citation_count, 10) || 0,
    })),
    formatDistribution: formatCounts,
    quizScoreDistribution: {
      highScore: high,      // >= 80%
      averageScore: medium, // 50 - 79%
      needsReview: low,     // < 50%
      totalCompleted: quizzes.rows.length,
    },
  };
}

/**
 * System health, vector memory stats, database footprint, and active model telemetry
 */
async function getSystemHealth() {
  // DB status & size
  let dbSize = 'Unknown';
  let dbStatus = 'healthy';
  try {
    const res = await pool.query(`SELECT pg_size_pretty(pg_database_size(current_database())) as size`);
    dbSize = res.rows[0]?.size || 'Unknown';
  } catch (err) {
    dbStatus = 'degraded';
  }

  // In-memory / file vector store stats
  const vectorStats = await getVectorStoreStats();

  // Process / Node.js telemetry
  const memoryUsage = process.memoryUsage();
  const heapUsedMB = (memoryUsage.heapUsed / 1024 / 1024).toFixed(1);
  const heapTotalMB = (memoryUsage.heapTotal / 1024 / 1024).toFixed(1);
  const uptimeSeconds = Math.floor(process.uptime());

  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const uptimePretty = `${hours}h ${minutes}m ${uptimeSeconds % 60}s`;

  return {
    database: {
      status: dbStatus,
      size: dbSize,
      engine: 'PostgreSQL',
    },
    vectorStore: {
      status: 'operational',
      ...vectorStats,
    },
    llmCluster: {
      status: 'operational',
      primaryModel: MODELS[0],
      activeFallbackModels: MODELS,
      fallbackTiersAvailable: MODELS.length,
    },
    runtime: {
      nodeVersion: process.version,
      heapUsedMB: `${heapUsedMB} MB`,
      heapTotalMB: `${heapTotalMB} MB`,
      uptime: uptimePretty,
    },
  };
}

module.exports = {
  getOverviewMetrics,
  getActivityTrends,
  getDocumentAnalytics,
  getSystemHealth,
};
