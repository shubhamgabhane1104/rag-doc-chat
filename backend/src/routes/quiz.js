const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db/db');
const { requireAuth } = require('../middleware/auth');
const { generateQuizFromChunks } = require('../services/quizService');

const router = express.Router();

/**
 * Generate a new Quiz or Viva question set for a document
 * POST /quiz/generate/:documentId
 */
router.post('/generate/:documentId', requireAuth, async (req, res) => {
  try {
    const { documentId } = req.params;
    const { type = 'mcq', count = 5, difficulty = 'medium' } = req.body;

    const validTypes = ['mcq', 'viva'];
    const quizType = validTypes.includes(type) ? type : 'mcq';
    const parsedCount = Math.min(Math.max(parseInt(count, 10) || 5, 3), 15);
    const validDifficulties = ['easy', 'medium', 'hard'];
    const quizDifficulty = validDifficulties.includes(difficulty?.toLowerCase())
      ? difficulty.toLowerCase()
      : 'medium';

    // 1. Verify document ownership and readiness
    const docResult = await pool.query(
      'SELECT id, filename, status FROM documents WHERE id = $1 AND user_id = $2',
      [documentId, req.userId]
    );
    const document = docResult.rows[0];

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    if (document.status !== 'ready') {
      return res.status(400).json({ error: `Document is not ready yet (status: ${document.status})` });
    }

    // 2. Fetch all document chunks
    const chunksResult = await pool.query(
      'SELECT page_number, chunk_text FROM chunks WHERE document_id = $1 ORDER BY chunk_index ASC',
      [documentId]
    );

    if (chunksResult.rows.length === 0) {
      return res.status(400).json({ error: 'No text chunks available for this document.' });
    }

    // 3. Generate questions using Gemini
    const questions = await generateQuizFromChunks(chunksResult.rows, {
      type: quizType,
      count: parsedCount,
      difficulty: quizDifficulty,
    });

    const quizId = uuidv4();
    const title = `${document.filename} · ${quizType.toUpperCase()} (${quizDifficulty.toUpperCase()})`;

    // 4. Save to database
    await pool.query(
      `INSERT INTO quizzes 
       (id, document_id, user_id, title, quiz_type, difficulty, questions, total_questions, completed) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)`,
      [
        quizId,
        documentId,
        req.userId,
        title,
        quizType,
        quizDifficulty,
        JSON.stringify(questions),
        questions.length,
      ]
    );

    res.status(201).json({
      id: quizId,
      documentId,
      title,
      quizType,
      difficulty: quizDifficulty,
      questions,
      totalQuestions: questions.length,
      completed: false,
    });
  } catch (err) {
    console.error('Quiz generation error:', err);
    res.status(500).json({
      error: err.message || 'Failed to generate quiz. Please check document content and try again.',
    });
  }
});

/**
 * List all quizzes/viva sets for a given document
 * GET /quiz/document/:documentId
 */
router.get('/document/:documentId', requireAuth, async (req, res) => {
  try {
    const { documentId } = req.params;

    const result = await pool.query(
      `SELECT id, document_id, title, quiz_type, difficulty, score, total_questions, completed, created_at 
       FROM quizzes 
       WHERE document_id = $1 AND user_id = $2 
       ORDER BY created_at DESC`,
      [documentId, req.userId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Fetch quizzes error:', err);
    res.status(500).json({ error: 'Failed to fetch quizzes' });
  }
});

/**
 * Get specific quiz details including questions & user answers
 * GET /quiz/:quizId
 */
router.get('/:quizId', requireAuth, async (req, res) => {
  try {
    const { quizId } = req.params;

    const result = await pool.query(
      'SELECT * FROM quizzes WHERE id = $1 AND user_id = $2',
      [quizId, req.userId]
    );
    const quiz = result.rows[0];

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    res.json(quiz);
  } catch (err) {
    console.error('Get quiz error:', err);
    res.status(500).json({ error: 'Failed to get quiz details' });
  }
});

/**
 * Submit answers for an MCQ quiz
 * POST /quiz/:quizId/submit
 */
router.post('/:quizId/submit', requireAuth, async (req, res) => {
  try {
    const { quizId } = req.params;
    const { userAnswers } = req.body; // e.g. [0, 2, 1, 3, ...] or { 0: 1, 1: 2 }

    const result = await pool.query(
      'SELECT * FROM quizzes WHERE id = $1 AND user_id = $2',
      [quizId, req.userId]
    );
    const quiz = result.rows[0];

    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const questions = quiz.questions || [];
    let score = 0;

    // Support both array and object format for userAnswers
    const answersArray = Array.isArray(userAnswers)
      ? userAnswers
      : questions.map((_, i) => userAnswers?.[i] ?? null);

    // Calculate score
    questions.forEach((q, idx) => {
      if (answersArray[idx] !== null && answersArray[idx] !== undefined) {
        if (Number(answersArray[idx]) === Number(q.correctAnswer)) {
          score += 1;
        }
      }
    });

    const totalQuestions = questions.length;

    await pool.query(
      `UPDATE quizzes 
       SET user_answers = $1, score = $2, completed = true 
       WHERE id = $3`,
      [JSON.stringify(answersArray), score, quizId]
    );

    res.json({
      id: quizId,
      score,
      totalQuestions,
      percentage: totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0,
      userAnswers: answersArray,
      questions,
      completed: true,
    });
  } catch (err) {
    console.error('Quiz submission error:', err);
    res.status(500).json({ error: 'Failed to submit quiz answers' });
  }
});

/**
 * Delete a quiz
 * DELETE /quiz/:quizId
 */
router.delete('/:quizId', requireAuth, async (req, res) => {
  try {
    const { quizId } = req.params;

    const result = await pool.query(
      'DELETE FROM quizzes WHERE id = $1 AND user_id = $2 RETURNING id',
      [quizId, req.userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    res.json({ success: true, id: quizId });
  } catch (err) {
    console.error('Delete quiz error:', err);
    res.status(500).json({ error: 'Failed to delete quiz' });
  }
});

module.exports = router;
