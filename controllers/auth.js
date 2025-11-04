// controllers/auth.js (temporary plain-text compare - remove when bcrypt is available)
import express from 'express';
import * as db from '../db.js';

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ success: false, error: 'username and password required' });

    const user = await db.getUserByUsername(username);
    if (!user) return res.status(401).json({ success: false, error: 'Invalid credentials' });

    if (String(user.password) !== String(password)) return res.status(401).json({ success: false, error: 'Invalid credentials' });

    req.session.user = { id: user.id, username: user.username, role: user.role };
    req.session.save(err => {
      if (err) {
        console.error('Session save error', err);
        return res.status(500).json({ success: false, error: 'Session error' });
      }
      return res.json({ success: true, role: user.role });
    });
  } catch (err) {
    console.error('POST /api/auth/login error', err && err.stack ? err.stack : err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.post('/logout', (req, res) => {
  if (!req.session) return res.json({ success: true });
  req.session.destroy(err => {
    if (err) {
      console.error('Session destroy error', err);
      return res.status(500).json({ success: false, error: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    return res.json({ success: true });
  });
});

router.get('/whoami', (req, res) => {
  return res.json({ user: req.session?.user ?? null });
});

export default router;
