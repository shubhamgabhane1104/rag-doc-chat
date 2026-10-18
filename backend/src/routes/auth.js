const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { OAuth2Client } = require('google-auth-library');
const { pool } = require('../db/db');

const router = express.Router();

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

function issueToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function publicUser(row) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    avatarUrl: row.avatar_url || null,
    authProvider: row.auth_provider || 'local',
  };
}

router.post('/signup', async (req, res) => {
  try {
    const { firstName, lastName, password } = req.body;
    const email = normalizeEmail(req.body.email);

    if (!firstName?.trim() || !lastName?.trim() || !email || !password) {
      return res.status(400).json({ error: 'First name, last name, email, and password are required' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // LOWER() also catches accounts created before emails were normalised
    const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (id, first_name, last_name, email, password_hash) VALUES ($1, $2, $3, $4, $5)',
      [uuidv4(), firstName.trim(), lastName.trim(), email, passwordHash]
    );

    res.status(201).json({ message: 'Account created successfully' });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Something went wrong during signup' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await pool.query(
      'SELECT * FROM users WHERE LOWER(email) = $1 ORDER BY created_at ASC LIMIT 1',
      [email]
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (!user.password_hash) {
      return res.status(401).json({ error: 'This account uses Google sign-in. Please continue with Google.' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    res.json({ token: issueToken(user.id), user: publicUser(user) });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Something went wrong during login' });
  }
});

/**
 * Google sign-in / sign-up.
 * Only accepts a Google ID token, verified against GOOGLE_CLIENT_ID.
 * (Previously this route also accepted a bare email in the body, which let
 * anyone log in as any user.)
 */
router.post('/google', async (req, res) => {
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  if (!googleClientId) {
    return res.status(503).json({ error: 'Google sign-in is not configured on this server.' });
  }

  const { credential } = req.body;
  if (!credential) {
    return res.status(400).json({ error: 'Missing Google credential' });
  }

  let payload;
  try {
    const client = new OAuth2Client(googleClientId);
    const ticket = await client.verifyIdToken({ idToken: credential, audience: googleClientId });
    payload = ticket.getPayload();
  } catch (err) {
    console.warn('Google token verification failed:', err.message);
    return res.status(401).json({ error: 'Google sign-in could not be verified. Please try again.' });
  }

  if (!payload?.email || payload.email_verified === false) {
    return res.status(401).json({ error: 'Your Google account email is not verified.' });
  }

  try {
    const email = normalizeEmail(payload.email);
    const firstName = payload.given_name || payload.name?.split(' ')[0] || 'User';
    const lastName = payload.family_name || payload.name?.split(' ').slice(1).join(' ') || '';

    const existing = await pool.query(
      'SELECT * FROM users WHERE LOWER(email) = $1 ORDER BY created_at ASC LIMIT 1',
      [email]
    );
    let user = existing.rows[0];
    const isNewUser = !user;

    if (!user) {
      const inserted = await pool.query(
        `INSERT INTO users (id, first_name, last_name, email, auth_provider, google_id, avatar_url)
         VALUES ($1, $2, $3, $4, 'google', $5, $6) RETURNING *`,
        [uuidv4(), firstName, lastName, email, payload.sub, payload.picture || null]
      );
      user = inserted.rows[0];
    } else {
      const updated = await pool.query(
        `UPDATE users
         SET google_id = COALESCE(google_id, $1),
             avatar_url = COALESCE(avatar_url, $2)
         WHERE id = $3 RETURNING *`,
        [payload.sub, payload.picture || null, user.id]
      );
      user = updated.rows[0];
    }

    res.json({ token: issueToken(user.id), user: publicUser(user), isNewUser });
  } catch (err) {
    console.error('Google auth error:', err);
    res.status(500).json({ error: 'Failed to authenticate with Google. Please try again.' });
  }
});

module.exports = router;
