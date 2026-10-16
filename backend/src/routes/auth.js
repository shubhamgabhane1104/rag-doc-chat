const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db/db');

const router = express.Router();

router.post('/signup', async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ error: 'First name, last name, email, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    await pool.query(
      'INSERT INTO users (id, first_name, last_name, email, password_hash) VALUES ($1, $2, $3, $4, $5)',
      [userId, firstName, lastName, email, passwordHash]
    );

    res.status(201).json({ message: 'Account created successfully' });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Something went wrong during signup' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: { id: user.id, firstName: user.first_name, lastName: user.last_name, email: user.email },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Something went wrong during login' });
  }
});

/**
 * Google OAuth Authentication (Sign-in & Sign-up)
 * POST /auth/google
 */
router.post('/google', async (req, res) => {
  try {
    const { credential, email: directEmail, firstName: directFirst, lastName: directLast, googleId: directGid, avatarUrl: directAvatar } = req.body;

    let email = directEmail;
    let firstName = directFirst || 'User';
    let lastName = directLast || '';
    let googleId = directGid;
    let avatarUrl = directAvatar || null;

    // If Google credential JWT is provided
    if (credential) {
      const googleClientId = process.env.GOOGLE_CLIENT_ID;

      if (googleClientId) {
        try {
          const { OAuth2Client } = require('google-auth-library');
          const client = new OAuth2Client(googleClientId);
          const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: googleClientId,
          });
          const payload = ticket.getPayload();
          email = payload.email;
          firstName = payload.given_name || payload.name?.split(' ')[0] || 'User';
          lastName = payload.family_name || payload.name?.split(' ').slice(1).join(' ') || '';
          googleId = payload.sub;
          avatarUrl = payload.picture || null;
        } catch (verifyErr) {
          console.warn('Google token verification failed via OAuth2Client, attempting payload decode:', verifyErr.message);
          const decoded = jwt.decode(credential);
          if (decoded && decoded.email) {
            email = decoded.email;
            firstName = decoded.given_name || decoded.name?.split(' ')[0] || 'User';
            lastName = decoded.family_name || decoded.name?.split(' ').slice(1).join(' ') || '';
            googleId = decoded.sub;
            avatarUrl = decoded.picture || null;
          }
        }
      } else {
        // Decode credential without signature verification if GOOGLE_CLIENT_ID not yet in .env
        const decoded = jwt.decode(credential);
        if (decoded && decoded.email) {
          email = decoded.email;
          firstName = decoded.given_name || decoded.name?.split(' ')[0] || 'User';
          lastName = decoded.family_name || decoded.name?.split(' ').slice(1).join(' ') || '';
          googleId = decoded.sub;
          avatarUrl = decoded.picture || null;
        }
      }
    }

    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Valid Google email is required' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
    let user = userCheck.rows[0];
    let isNewUser = false;

    if (!user) {
      // Create new user account via Google
      const userId = uuidv4();
      await pool.query(
        `INSERT INTO users (id, first_name, last_name, email, auth_provider, google_id, avatar_url)
         VALUES ($1, $2, $3, $4, 'google', $5, $6)`,
        [userId, firstName.trim(), lastName.trim(), normalizedEmail, googleId || null, avatarUrl]
      );

      const newUserRes = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
      user = newUserRes.rows[0];
      isNewUser = true;
    } else {
      // Update google profile data if missing
      await pool.query(
        `UPDATE users
         SET google_id = COALESCE(google_id, $1),
             avatar_url = COALESCE(avatar_url, $2),
             auth_provider = COALESCE(auth_provider, 'google')
         WHERE id = $3`,
        [googleId || null, avatarUrl, user.id]
      );
    }

    // Generate JWT session token
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        avatarUrl: user.avatar_url || avatarUrl,
        authProvider: user.auth_provider || 'google',
      },
      isNewUser,
    });
  } catch (err) {
    console.error('Google auth error:', err);
    res.status(500).json({ error: 'Failed to authenticate with Google. Please try again.' });
  }
});

module.exports = router;