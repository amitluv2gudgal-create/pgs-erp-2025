// controllers/auth.js
// ES module controller for authentication (login/logout + middleware)
// uses bcrypt for password comparison and an in-memory session store for simple testing
import bcrypt from 'bcrypt';
import cookie from 'cookie';
import { query, run } from '../db.js'; // using named exports from db.js

// simple in-memory session store (for testing only)
// production: replace with Redis or DB-backed session store
const sessions = new Map();

/**
 * login(req, res)
 * expects JSON body: { username, password }
 * sets httpOnly cookie 'sid' on success
 */
export async function login(req, res) {
  try {
    const body = req.body || {};
    const username = (body.username || '').toString().trim();
    const password = (body.password || '').toString();

    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }

    // find user
    const rows = await query('SELECT id, username, password, role FROM users WHERE username = ?', [username]);
    const user = Array.isArray(rows) && rows.length ? rows[0] : null;

    if (!user) {
      // avoid leaking which part is wrong
      console.warn(`[auth] login failed: unknown username "${username}"`);
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const stored = user.password || '';

    let passwordMatches = false;
    // If stored looks like bcrypt hash, use bcrypt.compare
    if (typeof stored === 'string' && stored.startsWith('$2')) {
      passwordMatches = await bcrypt.compare(password, stored);
    } else {
      // fallback to plaintext match (not recommended)
      passwordMatches = password === stored;
    }

    if (!passwordMatches) {
      console.warn(`[auth] login failed: wrong password for username "${username}" (id:${user.id})`);
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // create session token
    const sid = 's_' + Date.now().toString(36) + Math.random().toString(36).slice(2,9);
    const sessionObj = { sid, userId: user.id, username: user.username, role: user.role, createdAt: Date.now() };
    sessions.set(sid, sessionObj);

    // set cookie options
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 6 // 6 hours in ms
    };

    res.cookie('sid', sid, cookieOptions);

    // return minimal user info
    return res.json({ success: true, user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    console.error('[auth.login] unexpected error', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * logout(req, res)
 * clears session cookie and removes session from store
 */
export async function logout(req, res) {
  try {
    const sid = req.cookies && req.cookies.sid;
    if (sid) {
      sessions.delete(sid);
    }
    res.clearCookie('sid');
    return res.json({ success: true });
  } catch (err) {
    console.warn('[auth.logout] error', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * requireAuth middleware
 * attaches req.user = { id, username, role } when authenticated
 */
export async function requireAuth(req, res, next) {
  try {
    const sid = req.cookies && req.cookies.sid;
    if (!sid) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const s = sessions.get(sid);
    if (!s) return res.status(401).json({ error: 'Not authenticated' });
    req.user = { id: s.userId, username: s.username, role: s.role };
    return next();
  } catch (err) {
    console.error('[auth.requireAuth] error', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * helper to get session (useful for debugging)
 */
export function getSession(sid) {
  return sessions.get(sid);
}
