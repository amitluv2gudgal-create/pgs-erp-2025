// controllers/auth.js
import express from 'express';
import bcrypt from 'bcrypt';
import { query } from '../db.js';

const router = express.Router();

// POST /login handler for both users and security supervisors
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  console.log('Login attempt:', { username, password }); // Debug log
  try {
    // Check users table first
    const users = await query('SELECT * FROM users WHERE username = ?', [username]);
    console.log('Users found:', users); // Debug log
    let user = users[0];
    if (users.length > 0) {
      const match = await bcrypt.compare(password, user.password);
      console.log('Password match for user:', match); // Debug log
      if (match) {
        req.session.user = { id: user.id, role: user.role };
        console.log('Session set:', req.session.user); // Debug log
        return res.json({ success: true, role: user.role });
      }
    }

    // If not found in users, check security_supervisors
    const supervisors = await query('SELECT * FROM security_supervisors WHERE username = ?', [username]);
    console.log('Supervisors found:', supervisors); // Debug log
    if (supervisors.length > 0) {
      const supervisor = supervisors[0];
      const match = await bcrypt.compare(password, supervisor.password);
      console.log('Password match for supervisor:', match); // Debug log
      if (match) {
        req.session.user = { id: supervisor.id, role: 'security_supervisor' };
        console.log('Session set:', req.session.user); // Debug log
        return res.json({ success: true, role: 'security_supervisor' });
      }
    }

    console.log('No valid user or supervisor found for username:', username);
    return res.status(401).json({ error: 'Invalid credentials' });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /logout handler
router.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.redirect('/login.html'); // Assumes static file serving is configured
  });
});

// GET /current-user handler
router.get('/current-user', (req, res) => {
  if (req.session?.user) {
    res.json(req.session.user);
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
});

export default router;