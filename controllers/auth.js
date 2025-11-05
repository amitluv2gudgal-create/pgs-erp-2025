// controllers/auth.js
import express from 'express';
import bcrypt from 'bcrypt';
import { query, run } from '../db.js';

const router = express.Router();

/**
 * Utility middlewares (session-based)
 */
function requireAuth(req, res, next) {
  if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
}
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(req.session.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

// ================== LOGIN (users + security supervisors) ==================
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  // console.log('Login attempt:', { username, password }); // Debug log
  console.log('Login attempt:', { username });
  try {
    // Check users table first
    const users = await query('SELECT * FROM users WHERE username = ?', [username]);
    // console.log('Users found:', users);
    // console.log('Users found:', users.length);
    if (users.length > 0) {
      const user = users[0];
      const match = await bcrypt.compare(password, user.password);
      // console.log('Password match for user:', match);
      // if (match) {
      //   req.session.user = { id: user.id, role: user.role, username: user.username };
      //   return res.json({ success: true, role: user.role });
      // }
      if (match) {
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Session error' });
    req.session.user = { id: user.id, role: user.role, username: user.username };
    req.session.save((err2) => {
      if (err2) return res.status(500).json({ error: 'Session save error' });
      return res.json({ success: true, role: user.role });
    });
  });
  return; // prevent fallthrough
}

    }

    // If not found in users, check security_supervisors
    const supervisors = await query('SELECT * FROM security_supervisors WHERE username = ?', [username]);
    // console.log('Supervisors found:', supervisors);
    if (supervisors.length > 0) {
      const supervisor = supervisors[0];
      const match = await bcrypt.compare(password, supervisor.password);
      // console.log('Password match for supervisor:', match);
      // if (match) {
      //   req.session.user = { id: supervisor.id, role: 'security_supervisor', username: supervisor.username };
      //   // console.log('Session set:', req.session.user);
      //   return res.json({ success: true, role: 'security_supervisor' });
      // }
      if (match) {
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Session error' });
    req.session.user = { id: supervisor.id, role: 'security_supervisor', username: supervisor.username };
    req.session.save((err2) => {
      if (err2) return res.status(500).json({ error: 'Session save error' });
      return res.json({ success: true, role: 'security_supervisor' });
    });
  });
  return; // prevent fallthrough
}

    }

    console.log('No valid user or supervisor found for username:', username);
    return res.status(401).json({ error: 'Invalid credentials' });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/logout', (req, res) => {
  try {
    console.log('[auth/logout] incoming. cookies=', req.headers.cookie);
    console.log('[auth/logout] session exists=', !!req.session, 'session=', req.session);

    // Try to destroy session if present
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error('[auth/logout] session.destroy error:', err);
          // still try to clear cookie
          res.clearCookie('pgs_sid', { path: '/', sameSite: 'none', secure: process.env.NODE_ENV === 'production' });
          // return success to client to avoid UX failure
          return res.status(200).json({ ok: true, note: 'session destroyed with error, cookie cleared' });
        }
        // success: clear cookie and return OK
        res.clearCookie('pgs_sid', { path: '/', sameSite: 'none', secure: process.env.NODE_ENV === 'production' });
        return res.status(200).json({ ok: true });
      });
    } else {
      // No session found on server: still clear cookie on client (in case cookie present but server lost session)
      res.clearCookie('pgs_sid', { path: '/', sameSite: 'none', secure: process.env.NODE_ENV === 'production' });
      return res.status(200).json({ ok: true, note: 'no session on server; cookie cleared' });
    }
  } catch (err) {
    console.error('[auth/logout] unexpected error:', err);
    // best-effort: clear cookie for client experience
    res.clearCookie('pgs_sid', { path: '/', sameSite: 'none', secure: process.env.NODE_ENV === 'production' });
    return res.status(200).json({ ok: true, note: 'error-handled, cookie cleared' });
  }
});

// ================== LOGOUT ==================
router.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.redirect('/login.html');
  });
});

// ================== CURRENT USER ==================
router.get('/current-user', (req, res) => {
  if (req.session?.user) {
    res.json(req.session.user);
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

// ================== CHANGE PASSWORD (self) ==================
// Only for admin, accountant, hr
// Body: { currentPassword, newPassword }
router.post(
  '/change-password',
  requireAuth,
  requireRole('admin', 'accountant', 'hr'),
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body || {};
      const me = req.session.user;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'currentPassword and newPassword are required' });
      }
      if (String(newPassword).length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters' });
      }

      // Only in users table (admin/accountant/hr live there)
      const rows = await query('SELECT id, password FROM users WHERE id = ?', [me.id]);
      if (!rows.length) return res.status(404).json({ error: 'User not found' });

      const ok = await bcrypt.compare(currentPassword, rows[0].password);
      if (!ok) return res.status(400).json({ error: 'Current password is incorrect' });

      const hash = await bcrypt.hash(newPassword, 10);
      await run('UPDATE users SET password = ? WHERE id = ?', [hash, me.id]);

      return res.json({ ok: true, message: 'Password changed successfully' });
    } catch (err) {
      console.error('change-password error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }
);

// ================== ADMIN RESET PASSWORD (others) ==================
// Admin can reset any user's or any security supervisor's password
// Body: { userId, role, newPassword }  role in ['admin','accountant','hr','security_supervisor']
router.post(
  '/admin/reset-password',
  requireAuth,
  requireRole('admin'),
  async (req, res) => {
    try {
      const { userId, role, newPassword } = req.body || {};
      if (!userId || !newPassword || !role) {
        return res.status(400).json({ error: 'userId, role and newPassword are required' });
      }
      if (String(newPassword).length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters' });
      }

      const hash = await bcrypt.hash(newPassword, 10);
      if (role === 'security_supervisor') {
        // Reset in security_supervisors
        await run('UPDATE security_supervisors SET password = ? WHERE id = ?', [hash, userId]);
      } else {
        // Reset in users (admin/accountant/hr)
        await run('UPDATE users SET password = ? WHERE id = ?', [hash, userId]);
      }

      // (Optional) Add an audit trail table if desired
      return res.json({ ok: true, message: 'Password reset successfully' });
    } catch (err) {
      console.error('admin-reset-password error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }
);

// ---------- APPEND THIS AT THE END OF controllers/auth.js ---------

/**
 * Admin lookup to resolve a username to ID (for users or supervisors)
 * GET /api/auth/lookup-user?role=admin|accountant|hr|security_supervisor&username=alice
 */
router.get('/lookup-user', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const role = String(req.query.role || '').trim();
    const username = String(req.query.username || '').trim();
    if (!role || !username) {
      return res.status(400).json({ error: 'role and username are required' });
    }
    if (!['admin','accountant','hr','security_supervisor'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    let rows;
    if (role === 'security_supervisor') {
      rows = await query('SELECT id, username FROM security_supervisors WHERE username = ?', [username]);
    } else {
      // users table for admin/accountant/hr
      rows = await query('SELECT id, username, role FROM users WHERE username = ? AND role = ?', [username, role]);
    }

    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    const row = rows[0];
    return res.json({ ok: true, id: row.id, role, username: row.username || username });
  } catch (err) {
    console.error('GET /lookup-user error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * Admin reset password for ANY user (including admin himself)
 * POST /api/auth/admin/reset-password
 * Body: { userId, role, newPassword }
 */
router.post('/admin/reset-password', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const { userId, role, newPassword } = req.body || {};
    if (!userId || !role || !newPassword) {
      return res.status(400).json({ error: 'userId, role, and newPassword are required' });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }
    if (!['admin','accountant','hr','security_supervisor'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const hash = await bcrypt.hash(newPassword, 10);

    if (role === 'security_supervisor') {
      const exists = await query('SELECT id FROM security_supervisors WHERE id = ?', [userId]);
      if (!exists.length) return res.status(404).json({ error: 'Supervisor not found' });
      await run('UPDATE security_supervisors SET password = ? WHERE id = ?', [hash, userId]);
    } else {
      const exists = await query('SELECT id FROM users WHERE id = ? AND role = ?', [userId, role]);
      if (!exists.length) return res.status(404).json({ error: 'User not found' });
      await run('UPDATE users SET password = ? WHERE id = ?', [hash, userId]);
    }

    return res.json({ ok: true, message: 'Password reset successfully' });
  } catch (err) {
    console.error('POST /admin/reset-password error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;
