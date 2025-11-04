// controllers/auth.js  (with debug endpoints - remove when done)
import express from 'express';
import * as db from '../db.js';

const router = express.Router();

// Regular login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    console.log('[AUTH DEBUG] login attempt, username:', username, ' passwordProvided:', !!password);

    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'username and password required' });
    }

    const user = await db.getUserByUsername(username);
    console.log('[AUTH DEBUG] user from db:', user ? { id: user.id, username: user.username, role: user.role } : null);

    if (!user) return res.status(401).json({ success: false, error: 'Invalid credentials' });

    if (String(user.password) !== String(password)) {
      console.warn('[AUTH DEBUG] password mismatch for user:', username);
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    req.session.user = { id: user.id, username: user.username, role: user.role };
    req.session.save(err => {
      if (err) {
        console.error('[AUTH DEBUG] session save error', err);
        return res.status(500).json({ success: false, error: 'Session error' });
      }
      console.log('[AUTH DEBUG] login successful for', username);
      return res.json({ success: true, role: user.role });
    });
  } catch (err) {
    console.error('[AUTH DEBUG] POST /api/auth/login error', err && err.stack ? err.stack : err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Regular logout
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

// whoami
router.get('/whoami', (req, res) => {
  return res.json({ user: req.session?.user ?? null });
});

/* ----------------- DEBUG ENDPOINTS (temporary) ----------------- */

// Return all users (for debugging). Includes password here to diagnose mismatch.
router.get('/debug-users', async (req, res) => {
  try {
    // we use db.openDb directly to query users
    const dbconn = await db.openDb();
    try {
      const rows = await dbconn.all(`SELECT id, username, password, role, created_at FROM users ORDER BY id`);
      return res.json({ success: true, users: rows });
    } finally {
      await dbconn.close();
    }
  } catch (err) {
    console.error('[AUTH DEBUG] GET /debug-users error', err && err.stack ? err.stack : err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Seed a user (create or update). If the username exists, we update the password & role.
router.post('/seed-user', async (req, res) => {
  try {
    const { username, password, role } = req.body || {};
    if (!username || !password) return res.status(400).json({ success: false, error: 'username & password required' });

    const dbconn = await db.openDb();
    try {
      const exists = await dbconn.get(`SELECT id FROM users WHERE username = ?`, username);
      if (exists) {
        await dbconn.run(`UPDATE users SET password = ?, role = ? WHERE username = ?`, password, role || 'accountant', username);
        return res.json({ success: true, message: 'User updated' });
      } else {
        const stmt = await dbconn.run(`INSERT INTO users (username, password, role) VALUES (?, ?, ?)`, username, password, role || 'accountant');
        return res.json({ success: true, message: 'User created', id: stmt.lastID ?? null });
      }
    } finally {
      await dbconn.close();
    }
  } catch (err) {
    console.error('[AUTH DEBUG] POST /seed-user error', err && err.stack ? err.stack : err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

/* ----------------- END DEBUG ----------------- */

export default router;
