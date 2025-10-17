// PGS-ERP/controllers/attendances.js
import express from 'express';
import { query, run } from '../db.js';

const router = express.Router();

/** List attendances (with employee name) */
router.get('/', async (req, res) => {
  try {
    const rows = await query(`
      SELECT a.*, e.name AS employee_name
      FROM attendances a
      LEFT JOIN employees e ON e.id = a.employee_id
      ORDER BY a.date DESC, a.id DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('GET /attendances error:', err);
    res.status(500).json({ error: err.message });
  }
});

/** HR creates attendance -> auto-verified (not pending) */
router.post('/', async (req, res) => {
  try {
    if (!req.session?.user || req.session.user.role !== 'hr') {
      return res.status(403).json({ error: 'Forbidden: only HR can submit this form' });
    }

    const { employee_id, date, present, client_id } = req.body;
    if (!employee_id || !date || present === undefined) {
      return res.status(400).json({ error: 'Missing required: employee_id, date, present' });
    }

    const submitted_by = 'hr';
    const status = 'verified'; // ✅ HR submissions are verified immediately

    await run(
      `INSERT INTO attendances (employee_id, date, present, client_id, submitted_by, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [employee_id, date, present ? 1 : 0, client_id || null, submitted_by, status]
    );

    res.json({ message: 'Attendance created (verified)' });
  } catch (err) {
    console.error('POST /attendances error:', err);
    res.status(500).json({ error: err.message });
  }
});

/** Supervisor creates attendance -> pending */
router.post('/supervisor', async (req, res) => {
  try {
    if (!req.session?.user || req.session.user.role !== 'security_supervisor') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    const { employee_id, date, present, client_id } = req.body;
    if (!employee_id || !date || present === undefined) {
      return res.status(400).json({ error: 'Missing required: employee_id, date, present' });
    }

    const submitted_by = 'supervisor';
    const status = 'pending'; // ✅ supervisors default to pending

    const { id } = await run(
      `INSERT INTO attendances (employee_id, date, present, client_id, submitted_by, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [employee_id, date, present ? 1 : 0, client_id || null, submitted_by, status]
    );

    res.json({ id, message: 'Attendance submitted for HR verification' });
  } catch (err) {
    console.error('POST /attendances/supervisor error:', err);
    res.status(500).json({ error: err.message });
  }
});

/** HR: approve a pending attendance -> verified */
router.post('/:id/approve', async (req, res) => {
  try {
    if (!req.session?.user || req.session.user.role !== 'hr') {
      return res.status(403).json({ error: 'Forbidden: HR only' });
    }
    const { id } = req.params;
    await run(`UPDATE attendances SET status = 'verified' WHERE id = ? AND status = 'pending'`, [id]);
    res.json({ message: 'Attendance verified' });
  } catch (err) {
    console.error('POST /attendances/:id/approve error:', err);
    res.status(500).json({ error: err.message });
  }
});

/** HR: reject a pending attendance -> rejected */
router.post('/:id/reject', async (req, res) => {
  try {
    if (!req.session?.user || req.session.user.role !== 'hr') {
      return res.status(403).json({ error: 'Forbidden: HR only' });
    }
    const { id } = req.params;
    await run(`UPDATE attendances SET status = 'rejected' WHERE id = ? AND status = 'pending'`, [id]);
    res.json({ message: 'Attendance rejected' });
  } catch (err) {
    console.error('POST /attendances/:id/reject error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
