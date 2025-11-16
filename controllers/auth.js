// controllers/auth.js
import express from 'express';
import bcrypt from 'bcrypt';
import { query, run } from '../db.js';

const router = express.Router();

/**
 * Utility middlewares (session-based)
 */
function requireAuth(req, res, next) {
  if (!req.session?.user) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  next();
}
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session?.user) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    if (!roles.includes(req.session.user.role)) return res.status(403).json({ ok: false, error: 'Forbidden' });
    next();
  };
}

// ================== LOGIN (users + security supervisors) ==================
// ===== REPLACE router.post('/login', ...) WITH THIS BLOCK =====
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  console.log('[AUTH] login attempt:', { username });

  // debug: headers & cookies
  console.log('[AUTH DEBUG] headers.host =', req.headers.host);
  console.log('[AUTH DEBUG] req.secure =', req.secure, 'x-forwarded-proto=', req.headers['x-forwarded-proto']);
  console.log('[AUTH DEBUG] incoming cookies header =', req.headers.cookie);

  if (!username || !password) {
    return res.status(400).json({ ok: false, error: 'username and password required' });
  }

  try {
    // Try users table
    const users = await query('SELECT * FROM users WHERE username = ?', [username]);
    if (users.length > 0) {
      const user = users[0];
      const match = await bcrypt.compare(password, user.password);
      console.log('[AUTH] users lookup matched?', !!user, 'passwordMatches:', match);
      if (match) {
        // SIMPLE approach: assign user to existing session (do NOT regenerate)
        req.session.user = { id: user.id, role: user.role, username: user.username };
        // Save session and return JSON. Express-session will set cookie on response if necessary.
        return req.session.save((err) => {
          if (err) {
            console.error('[AUTH] session save error:', err);
            return res.status(500).json({ ok: false, error: 'Session save error' });
          }
          // DEBUG: echo session id cookie from server req.sessionID
          console.log('[AUTH] login success (user). sessionID:', req.sessionID, 'session.user:', req.session.user);

          // Ensure browser receives updated cookie: send a fresh Set-Cookie header as fallback (safe)
          // WARNING: express-session already sets cookie; this is a redundant fallback for stubborn clients.
          try {
            const sidName = (req.session && req.session.cookie && req.session.cookie.name) ? req.session.cookie.name : 'connect.sid';
            // Do not override secure/samesite attributes — rely on express-session; this is just a fallback
            // Commented because usually not necessary; uncomment if you observe no Set-Cookie header in HTTP response
            // res.setHeader('Set-Cookie', `${sidName}=${encodeURIComponent(req.sessionID)}; Path=/; HttpOnly; SameSite=Lax`);
          } catch(e) {
            // ignore
          }

          return res.status(200).json({ ok: true, role: user.role, user: { id: user.id, username: user.username } });
        });
      }
    }

    // Try supervisors
    const supervisors = await query('SELECT * FROM security_supervisors WHERE username = ?', [username]);
    if (supervisors.length > 0) {
      const sup = supervisors[0];
      const match = await bcrypt.compare(password, sup.password);
      console.log('[AUTH] supervisors lookup matched?', !!sup, 'passwordMatches:', match);
      if (match) {
        req.session.user = { id: sup.id, role: 'security_supervisor', username: sup.username };
        return req.session.save((err) => {
          if (err) {
            console.error('[AUTH] session save error (supervisor):', err);
            return res.status(500).json({ ok: false, error: 'Session save error' });
          }
          console.log('[AUTH] login success (supervisor). sessionID:', req.sessionID);
          return res.status(200).json({ ok: true, role: 'security_supervisor', user: { id: sup.id, username: sup.username } });
        });
      }
    }

    console.log('[AUTH] No valid user or supervisor found for username:', username);
    return res.status(401).json({ ok: false, error: 'Invalid credentials' });
  } catch (err) {
    console.error('[AUTH] Login error:', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});


// ================== LOGOUT ==================
router.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('[AUTH] Logout error:', err);
      return res.status(500).json({ ok: false, error: 'Failed to logout' });
    }
    // redirect to login page
    res.clearCookie?.(); // no-op if not present; cookie cleared by session.destroy in default express-session
    return res.redirect('/login.html');
  });
});

// ================== CURRENT USER ==================
router.get('/current-user', (req, res) => {
  if (req.session?.user) {
    return res.json({ ok: true, user: req.session.user });
  } else {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
});

// ================== CHANGE PASSWORD (self) ==================
// Only for admin, accountant, hr
router.post(
  '/change-password',
  requireAuth,
  requireRole('admin', 'accountant', 'hr'),
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body || {};
      const me = req.session.user;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ ok: false, error: 'currentPassword and newPassword are required' });
      }
      if (String(newPassword).length < 8) {
        return res.status(400).json({ ok: false, error: 'New password must be at least 8 characters' });
      }

      const rows = await query('SELECT id, password FROM users WHERE id = ?', [me.id]);
      if (!rows.length) return res.status(404).json({ ok: false, error: 'User not found' });

      const ok = await bcrypt.compare(currentPassword, rows[0].password);
      if (!ok) return res.status(400).json({ ok: false, error: 'Current password is incorrect' });

      const hash = await bcrypt.hash(newPassword, 10);
      await run('UPDATE users SET password = ? WHERE id = ?', [hash, me.id]);

      return res.json({ ok: true, message: 'Password changed successfully' });
    } catch (err) {
      console.error('[AUTH] change-password error:', err);
      return res.status(500).json({ ok: false, error: 'Server error' });
    }
  }
);

// ================== ADMIN RESET PASSWORD (others) ==================
router.post(
  '/admin/reset-password',
  requireAuth,
  requireRole('admin'),
  async (req, res) => {
    try {
      const { userId, role, newPassword } = req.body || {};
      if (!userId || !newPassword || !role) {
        return res.status(400).json({ ok: false, error: 'userId, role and newPassword are required' });
      }
      if (String(newPassword).length < 8) {
        return res.status(400).json({ ok: false, error: 'New password must be at least 8 characters' });
      }

      const hash = await bcrypt.hash(newPassword, 10);
      if (role === 'security_supervisor') {
        await run('UPDATE security_supervisors SET password = ? WHERE id = ?', [hash, userId]);
      } else {
        await run('UPDATE users SET password = ? WHERE id = ?', [hash, userId]);
      }

      return res.json({ ok: true, message: 'Password reset successfully' });
    } catch (err) {
      console.error('[AUTH] admin-reset-password error:', err);
      return res.status(500).json({ ok: false, error: 'Server error' });
    }
  }
);

// Lookup endpoint for admin tools (keeps previous behavior but uniform responses)
router.get('/lookup-user', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const role = String(req.query.role || '').trim();
    const username = String(req.query.username || '').trim();
    if (!role || !username) {
      return res.status(400).json({ ok: false, error: 'role and username are required' });
    }
    if (!['admin','accountant','hr','security_supervisor'].includes(role)) {
      return res.status(400).json({ ok: false, error: 'Invalid role' });
    }

    let rows;
    if (role === 'security_supervisor') {
      rows = await query('SELECT id, username FROM security_supervisors WHERE username = ?', [username]);
    } else {
      rows = await query('SELECT id, username, role FROM users WHERE username = ? AND role = ?', [username, role]);
    }

    if (!rows.length) return res.status(404).json({ ok: false, error: 'User not found' });
    const row = rows[0];
    return res.json({ ok: true, id: row.id, role, username: row.username || username });
  } catch (err) {
    console.error('[AUTH] GET /lookup-user error:', err);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
});

export default router;
