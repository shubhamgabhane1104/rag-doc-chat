const express = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  getOverviewMetrics,
  getActivityTrends,
  getDocumentAnalytics,
  getSystemHealth,
} = require('../services/analyticsService');

const router = express.Router();

/**
 * Get unified dashboard analytics (overview, trends, doc leaderboard, system health)
 * GET /analytics/all
 */
router.get('/all', requireAuth, async (req, res) => {
  try {
    const days = parseInt(req.query.days, 10) || 7;
    const [overview, trends, documentAnalytics, health] = await Promise.all([
      getOverviewMetrics(req.userId),
      getActivityTrends(req.userId, days),
      getDocumentAnalytics(req.userId),
      getSystemHealth(),
    ]);

    res.json({
      overview,
      trends,
      documentAnalytics,
      health,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Analytics /all error:', err);
    res.status(500).json({ error: 'Failed to retrieve system analytics.' });
  }
});

/**
 * Get overview KPIs & trends
 * GET /analytics/overview
 */
router.get('/overview', requireAuth, async (req, res) => {
  try {
    const days = parseInt(req.query.days, 10) || 7;
    const [overview, trends] = await Promise.all([
      getOverviewMetrics(req.userId),
      getActivityTrends(req.userId, days),
    ]);

    res.json({ overview, trends });
  } catch (err) {
    console.error('Analytics /overview error:', err);
    res.status(500).json({ error: 'Failed to retrieve overview metrics.' });
  }
});

/**
 * Get document leaderboard and file distribution
 * GET /analytics/documents
 */
router.get('/documents', requireAuth, async (req, res) => {
  try {
    const data = await getDocumentAnalytics(req.userId);
    res.json(data);
  } catch (err) {
    console.error('Analytics /documents error:', err);
    res.status(500).json({ error: 'Failed to retrieve document analytics.' });
  }
});

/**
 * Get system and vector store health
 * GET /analytics/system-health
 */
router.get('/system-health', requireAuth, async (req, res) => {
  try {
    const health = await getSystemHealth();
    res.json(health);
  } catch (err) {
    console.error('Analytics /system-health error:', err);
    res.status(500).json({ error: 'Failed to retrieve system health.' });
  }
});

module.exports = router;
