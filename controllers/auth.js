// controllers/auth.js
import express from 'express';
import bcrypt from 'bcryptjs'; // if you use bcryptjs for passwords
// import your DB utils as needed (example: getUserByUsername, verifyPassword, createSession)
import { getUserByUsername } from '../lib/db-users.js'; // adapt path if needed

const router = express.Router();

// health-check style current-user endpoint
router.get('/current-user', (req, res) => {
  try {
    // if session exists, return user info
    if (req.session && req.session.user) {
      return res.json(req.session.user);
    }
    // not logged in
    return res.status(401).json({ error: 'Unauthorized' });
  } catch (err) {
    console.error('[auth/current-user] error', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// login endpoint (example - adapt to your DB)
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });

    // fetch user record from DB (adapt function)
    const user = await getUserByUsername(username);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    // verify password (adapt as needed)
    const valid = await bcrypt.compare(password, user.passwordHash || '');
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    // set session user
    req.session.user = {
      id: user.id,
      username: user.username,
      role: user.role || 'user',
      name: user.name || user.username
    };

    // send JSON response and session cookie (session middleware handles Set-Cookie)
    return res.json({ ok: true, user: req.session.user });

  } catch (err) {
    console.error('[auth/login] error', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Explicit logout route that returns JSON and clears cookie
router.post('/logout', (req, res) => {
  try {
    console.log('[auth/logout] incoming. cookies=', req.headers.cookie ?? '(none)');
    console.log('[auth/logout] session exists=', !!req.session, 'session=', req.session ? { ...req.session.user } : null);

    const cookieName = 'pgs_sid'; // ensure this matches session.name in server.js

    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error('[auth/logout] destroy error', err);
          res.clearCookie(cookieName, { path: '/', sameSite: 'none', secure: process.env.NODE_ENV === 'production' });
          return res.status(200).json({ ok: true, note: 'destroy-error, cookie-cleared' });
        }
        res.clearCookie(cookieName, { path: '/', sameSite: 'none', secure: process.env.NODE_ENV === 'production' });
        return res.status(200).json({ ok: true });
      });
    } else {
      res.clearCookie(cookieName, { path: '/', sameSite: 'none', secure: process.env.NODE_ENV === 'production' });
      return res.status(200).json({ ok: true, note: 'no-server-session, cookie-cleared' });
    }
  } catch (err) {
    console.error('[auth/logout] unexpected error', err);
    res.clearCookie('pgs_sid', { path: '/', sameSite: 'none', secure: process.env.NODE_ENV === 'production' });
    return res.status(200).json({ ok: true, note: 'error-handled, cookie-cleared' });
  }
});

export default router;
