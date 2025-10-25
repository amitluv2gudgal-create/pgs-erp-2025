// controllers/auth.js
import express from 'express';
import * as bcrypt from 'bcryptjs';
import { query, run } from '../db.js';

const router = express.Router();

// Normalize role helper (lowercase string)
function normRole(role) {
  return String(role || '').toLowerCase();
}

// Who am I
router.get('/me', (req, res) => {
  if (req.session?.user) return res.json(req.session.user);
  return res.status(401).json({ error: 'Unauthorized' });
});

/** Login: supports users (admin/hr/accountant) and security supervisors */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    console.log('[auth] login attempt:', username);

    // Try users
    const users = await query('SELECT * FROM users WHERE username = $1', [username]); // if you’ve changed to PG param style
    if (users.length) {
      const u = users[0];
      const ok = await bcrypt.compare(password, u.password || '');
      if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

      const role = String(u.role || '').toLowerCase();
      req.session.user = { id: u.id, role, username: u.username };

      return req.session.save((err) => {
        if (err) {
          console.error('[auth] session save error:', err);
          return res.status(500).json({ error: 'Session error' });
        }
        console.log('[auth] login OK (users):', { id: u.id, role, username: u.username });
        res.json({ ok: true, role });
      });
    }

    // Try supervisors
    const sups = await query('SELECT * FROM security_supervisors WHERE username = $1', [username]);
    if (sups.length) {
      const s = sups[0];
      const ok = await bcrypt.compare(password, s.password || '');
      if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

      const role = 'security_supervisor';
      req.session.user = { id: s.id, role, username: s.username };

      return req.session.save((err) => {
        if (err) {
          console.error('[auth] session save error (sup):', err);
          return res.status(500).json({ error: 'Session error' });
        }
        console.log('[auth] login OK (sup):', { id: s.id, role, username: s.username });
        res.json({ ok: true, role });
      });
    }

    return res.status(401).json({ error: 'Invalid credentials' });
  } catch (err) {
    console.error('[auth] /login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


/** Logout */
router.post('/logout', (req, res) => {
  if (!req.session) return res.json({ ok: true });
  req.session.destroy((err) => {
    if (err) {
      console.warn('Session destroy error:', err);
      return res.status(500).json({ error: 'Logout error' });
    }
    res.json({ ok: true });
  });
});

// GET /current-user handler
router.get('/current-user', (req, res) => {
  if (req.session?.user) return res.json(req.session.user);
  return res.status(401).json({ error: 'Unauthorized' });
});

function requireAuth(req, res, next) {
  if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
  // normalize role once on the request
  req.session.user.role = normRole(req.session.user.role);
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session?.user || normRole(req.session.user.role) !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  next();
}

/** List all app users and supervisors (no passwords returned) */
router.get('/admin/users', requireAdmin, async (_req, res) => {
  try {
    const users = await query(`SELECT id, username, role FROM users ORDER BY role, username`);
    const supervisors = await query(`SELECT id, username, name, client_id, site_name FROM security_supervisors ORDER BY username`);
    res.set('Cache-Control', 'no-store');
    res.json({ users, supervisors });
  } catch (err) {
    console.error('GET /api/auth/admin/users error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Self change password (admin/accountant/hr only) */
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    const role = normRole(req.session.user.role);
    const allowed = new Set(['admin', 'accountant', 'hr']); // 🚫 supervisors excluded
    if (!allowed.has(role)) return res.status(403).json({ error: 'Not allowed for your role' });

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword and newPassword are required' });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const me = await query('SELECT id, password FROM users WHERE id = ?', [req.session.user.id]);
    if (!me.length) return res.status(404).json({ error: 'User not found' });

    const ok = await bcrypt.compare(currentPassword, me[0].password || '');
    if (!ok) return res.status(400).json({ error: 'Current password is incorrect' });

    const newHash = await bcrypt.hash(newPassword, 10);
    await run('UPDATE users SET password = ? WHERE id = ?', [newHash, req.session.user.id]);

    res.json({ ok: true, message: 'Password updated' });
  } catch (e) {
    console.error('[auth] change-password error:', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

/** Admin: reset password for a user in "users" table (admin/accountant/hr) */
router.post('/admin/users/:id/reset-password', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { new_password } = req.body || {};
    if (!new_password || String(new_password).length < 6) {
      return res.status(400).json({ error: 'new_password must be at least 6 characters' });
    }
    const rows = await query(`SELECT id FROM users WHERE id = ?`, [id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });

    const hash = await bcrypt.hash(String(new_password), 10);
    await run(`UPDATE users SET password = ? WHERE id = ?`, [hash, id]);

    res.json({ message: 'Password reset successfully for user', id: Number(id) });
  } catch (err) {
    console.error('POST /api/auth/admin/users/:id/reset-password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Admin: reset password for a security supervisor */
router.post('/admin/supervisors/:id/reset-password', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { new_password } = req.body || {};
    if (!new_password || String(new_password).length < 6) {
      return res.status(400).json({ error: 'new_password must be at least 6 characters' });
    }
    const rows = await query(`SELECT id FROM security_supervisors WHERE id = ?`, [id]);
    if (!rows.length) return res.status(404).json({ error: 'Supervisor not found' });

    const hash = await bcrypt.hash(String(new_password), 10);
    await run(`UPDATE security_supervisors SET password = ? WHERE id = ?`, [hash, id]);

    res.json({ message: 'Password reset successfully for supervisor', id: Number(id) });
  } catch (err) {
    console.error('POST /api/auth/admin/supervisors/:id/reset-password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generic admin reset by userId or username
router.post('/admin/reset-password', requireAdmin, async (req, res) => {
  try {
    const { userId, username, newPassword } = req.body || {};
    if (!newPassword || String(newPassword).length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }
    if (!userId && !username) {
      return res.status(400).json({ error: 'Provide userId or username' });
    }

    let rows;
    if (userId) rows = await query('SELECT id FROM users WHERE id = ?', [userId]);
    else rows = await query('SELECT id FROM users WHERE username = ?', [username]);

    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    const targetId = rows[0].id;

    const hash = await bcrypt.hash(newPassword, 10);
    await run('UPDATE users SET password = ? WHERE id = ?', [hash, targetId]);

    // Minimal audit
    await run(`
      CREATE TABLE IF NOT EXISTS admin_password_resets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_id INTEGER,
        target_user_id INTEGER,
        at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await run('INSERT INTO admin_password_resets (admin_id, target_user_id) VALUES (?, ?)', [req.session.user.id, targetId]);

    res.json({ ok: true, message: 'Password reset by admin' });
  } catch (e) {
    console.error('[admin] reset-password error:', e);
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;
