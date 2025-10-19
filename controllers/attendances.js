// PGS-ERP/controllers/attendances.js
import express from 'express';
import { query, run } from '../db.js';

const router = express.Router();

// Block supervisors from viewing attendance data via GET
router.use((req, res, next) => {
  const role = req.session?.user?.role;
  if (role === 'security_supervisor' && req.method === 'GET') {
    return res.status(403).json({ error: 'Forbidden: supervisors cannot view attendance data' });
  }
  next();
});

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
    console.log('[HR ATTENDANCE] req.body:', req.body); // <-- what frontend sent

    if (!employee_id || !date || present === undefined) {
      return res.status(400).json({ error: 'Missing required: employee_id, date, present' });
    }

    const p = Number(present);
    if (![0, 1, 2].includes(p)) {
      return res.status(400).json({ error: 'present must be 0, 1, or 2' });
    }

    const submitted_by = 'hr';
    const status = 'verified';

    console.log('[HR ATTENDANCE] inserting:', { employee_id, date, p, client_id: client_id ?? null, submitted_by, status });

    const result = await run(
      `INSERT INTO attendances (employee_id, date, present, client_id, submitted_by, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [employee_id, date, p, client_id || null, submitted_by, status]
    );

    const insertedId = result?.lastID ?? result?.insertId;
    const row = await query(`SELECT id, employee_id, date, present, submitted_by, status, client_id FROM attendances WHERE id = ?`, [insertedId]);
    console.log('[HR ATTENDANCE] stored row:', row[0]);

    res.json({ message: 'Attendance created (verified)', saved: row[0] });
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

    let { employee_id, date, present, client_id } = req.body;
    console.log('[SUP ATTENDANCE] req.body:', req.body); // <-- what frontend sent

    if (!employee_id || !date || present === undefined) {
      return res.status(400).json({ error: 'Missing required: employee_id, date, present' });
    }

    const p = Number(present);
    if (![0, 1, 2].includes(p)) {
      return res.status(400).json({ error: 'present must be 0, 1, or 2' });
    }

    const submitted_by = 'supervisor';
    const status = 'pending';

    console.log('[SUP ATTENDANCE] inserting:', { employee_id, date, p, client_id: client_id ?? null, submitted_by, status });

    const result = await run(
      `INSERT INTO attendances (employee_id, date, present, client_id, submitted_by, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [employee_id, date, p, client_id || null, submitted_by, status]
    );

    const insertedId = result?.lastID ?? result?.insertId;
    const row = await query(`SELECT id, employee_id, date, present, submitted_by, status, client_id FROM attendances WHERE id = ?`, [insertedId]);
    console.log('[SUP ATTENDANCE] stored row:', row[0]);

    res.json({ id: insertedId, message: 'Attendance submitted for HR verification', saved: row[0] });
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
