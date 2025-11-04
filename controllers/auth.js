// controllers/auth.js
import express from 'express';
import * as db from '../db.js';

const router = express.Router();

// POST /api/auth/login
// body: { username, password }
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ success: false, error: 'username and password required' });

    const user = await db.getUserByUsername(username);
    if (!user) return res.status(401).json({ success: false, error: 'Invalid credentials' });

    // NOTE: For production, replace this plain-text check with bcrypt hashed password check
    if (user.password !== password) return res.status(401).json({ success: false, error: 'Invalid credentials' });

    // set session user
    req.session.user = { id: user.id, username: user.username, role: user.role };
    // optionally save session immediately
    req.session.save(err => {
      if (err) {
        console.error('Session save error after login', err);
        return res.status(500).json({ success: false, error: 'Session error' });
      }
      return res.json({ success: true, role: user.role });
    });
  } catch (err) {
    console.error('POST /api/auth/login error', err && err.stack ? err.stack : err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  if (!req.session) return res.json({ success: true });
  req.session.destroy(err => {
    if (err) {
      console.error('Session destroy error', err);
      return res.status(500).json({ success: false, error: 'Logout failed' });
    }
    res.clearCookie('connect.sid'); // default name for express-session cookie
    return res.json({ success: true });
  });
});

// GET /api/auth/whoami (optional)
router.get('/whoami', (req, res) => {
  return res.json({ user: req.session?.user ?? null });
});

export default router;
