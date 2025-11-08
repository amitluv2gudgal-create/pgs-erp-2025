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
  const { username, password } = req.body || {};
  console.log('Login attempt:', { username });
  try {
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });

    // Check users table first
    const users = await query('SELECT * FROM users WHERE username = ?', [username]);
    if (users.length > 0) {
      const user = users[0];
      const match = await bcrypt.compare(password, user.password);
      if (match) {
        // regenerate session to avoid fixation
        return req.session.regenerate((err) => {
          if (err) {
            console.error('Session regenerate error:', err);
            return res.status(500).json({ error: 'Session error' });
          }
          req.session.user = { id: user.id, role: user.role, username: user.username };
          req.session.save((err2) => {
            if (err2) {
              console.error('Session save error:', err2);
              return res.status(500).json({ error: 'Session save error' });
            }
            return res.json({ success: true, role: user.role, username: user.username });
          });
        });
      }
    }

    // If not found in users, check security_supervisors
    const supervisors = await query('SELECT * FROM security_supervisors WHERE username = ?', [username]);
    if (supervisors.length > 0) {
      const supervisor = supervisors[0];
      const match = await bcrypt.compare(password, supervisor.password);
      if (match) {
        return req.session.regenerate((err) => {
          if (err) {
            console.error('Session regenerate error:', err);
            return res.status(500).json({ error: 'Session error' });
          }
          req.session.user = { id: supervisor.id, role: 'security_supervisor', username: supervisor.username };
          req.session.save((err2) => {
            if (err2) {
              console.error('Session save error:', err2);
              return res.status(500).json({ error: 'Session save error' });
            }
            return res.json({ success: true, role: 'security_supervisor', username: supervisor.username });
          });
        });
      }
    }

    console.log('No valid user or supervisor found for username:', username);
    return res.status(401).json({ error: 'Invalid credentials' });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// ================== LOGOUT ==================
router.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Failed to logout' });
    }
    // If client expects redirect, this will send it; else client can call /api/auth/logout and handle
    res.clearCookie?.('connect.sid');
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

      return res.json({ ok: true, message: 'Password reset successfully' });
    } catch (err) {
      console.error('admin-reset-password error:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  }
);

// Admin lookup to resolve a username to ID
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

// Admin reset password for any user (duplicate-safe endpoint)
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
