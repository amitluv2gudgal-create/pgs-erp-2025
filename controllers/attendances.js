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

/** Get a single attendance by id (HR/Admin/Accountant can use) */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await query(`
      SELECT a.*, e.name AS employee_name
      FROM attendances a
      LEFT JOIN employees e ON e.id = a.employee_id
      WHERE a.id = ?
    `, [id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /attendances/:id error:', err);
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
    const p = Number(present);
    if (![0,1,2].includes(p)) {
      return res.status(400).json({ error: 'present must be 0, 1, or 2' });
    }

    const submitted_by = 'hr';
    const status = 'verified'; // HR submissions are verified immediately

    const result = await run(
      `INSERT INTO attendances (employee_id, date, present, client_id, submitted_by, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [employee_id, date, p, client_id || null, submitted_by, status]
    );

    res.json({ message: 'Attendance created (verified)', id: result?.lastID ?? result?.insertId });
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
    if (!employee_id || !date || present === undefined) {
      return res.status(400).json({ error: 'Missing required: employee_id, date, present' });
    }
    const p = Number(present);
    if (![0,1,2].includes(p)) {
      return res.status(400).json({ error: 'present must be 0, 1, or 2' });
    }

    const submitted_by = 'supervisor';
    const status = 'pending'; // supervisors default to pending

    const result = await run(
      `INSERT INTO attendances (employee_id, date, present, client_id, submitted_by, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [employee_id, date, p, client_id || null, submitted_by, status]
    );

    res.json({ id: result?.lastID ?? result?.insertId, message: 'Attendance submitted for HR verification' });
  } catch (err) {
    console.error('POST /attendances/supervisor error:', err);
    res.status(500).json({ error: err.message });
  }
});

/** HR: update (edit) an attendance */
router.put('/:id', async (req, res) => {
  try {
    if (!req.session?.user || req.session.user.role !== 'hr') {
      return res.status(403).json({ error: 'Forbidden: HR only' });
    }
    const { id } = req.params;
    const { employee_id, date, present, client_id, status } = req.body;

    // Basic validation: allow updating these fields; present must be 0/1/2 if provided
    if (present !== undefined) {
      const p = Number(present);
      if (![0,1,2].includes(p)) {
        return res.status(400).json({ error: 'present must be 0, 1, or 2' });
      }
    }

    // Build dynamic update
    const fields = [];
    const values = [];
    if (employee_id !== undefined) { fields.push('employee_id = ?'); values.push(employee_id); }
    if (date !== undefined)        { fields.push('date = ?');        values.push(date); }
    if (present !== undefined)     { fields.push('present = ?');     values.push(Number(present)); }
    if (client_id !== undefined)   { fields.push('client_id = ?');   values.push(client_id || null); }
    if (status !== undefined)      { fields.push('status = ?');      values.push(status); }

    if (!fields.length) return res.status(400).json({ error: 'No fields to update' });

    values.push(id);
    await run(`UPDATE attendances SET ${fields.join(', ')} WHERE id = ?`, values);

    const rows = await query('SELECT * FROM attendances WHERE id = ?', [id]);
    res.json({ message: 'Updated', attendance: rows[0] });
  } catch (err) {
    console.error('PUT /attendances/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

/** HR: delete an attendance */
router.delete('/:id', async (req, res) => {
  try {
    if (!req.session?.user || req.session.user.role !== 'hr') {
      return res.status(403).json({ error: 'Forbidden: HR only' });
    }
    const { id } = req.params;
    await run('DELETE FROM attendances WHERE id = ?', [id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('DELETE /attendances/:id error:', err);
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

// ==== GET one attendance by ID (for edit modal) ====
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid ID' });

    const rows = await query('SELECT * FROM attendances WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Attendance not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /attendances/:id error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==== UPDATE one attendance (PUT) ====
// Allowed: HR only (and admin if you wish; uncomment to include admin)
router.put('/:id', async (req, res) => {
  try {
    const role = req.session?.user?.role;
    if (!role) return res.status(401).json({ error: 'Unauthorized' });
    if (!['hr', 'admin'].includes(role)) return res.status(403).json({ error: 'Forbidden' });

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid ID' });

    const rows = await query('SELECT * FROM attendances WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Attendance not found' });
    const cur = rows[0];

    const {
      employee_id = cur.employee_id,
      client_id = cur.client_id,
      date = cur.date,
      present = cur.present
      // status remains via approve/reject endpoints
    } = (req.body || {});

    await run(
      `UPDATE attendances
          SET employee_id=?, client_id=?, date=?, present=?
        WHERE id=?`,
      [employee_id, client_id, date, present, id]
    );

    res.json({ ok: true, message: 'Attendance updated' });
  } catch (err) {
    console.error('PUT /attendances/:id error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==== APPROVE ====
router.post('/:id/approve', async (req, res) => {
  try {
    const role = req.session?.user?.role;
    if (!role) return res.status(401).json({ error: 'Unauthorized' });
    if (role !== 'hr') return res.status(403).json({ error: 'Forbidden' });

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid ID' });

    const rows = await query('SELECT id FROM attendances WHERE id=?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Attendance not found' });

    await run('UPDATE attendances SET status=? WHERE id=?', ['approved', id]);
    res.json({ ok: true, message: 'Attendance approved' });
  } catch (err) {
    console.error('POST /attendances/:id/approve error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==== REJECT ====
router.post('/:id/reject', async (req, res) => {
  try {
    const role = req.session?.user?.role;
    if (!role) return res.status(401).json({ error: 'Unauthorized' });
    if (role !== 'hr') return res.status(403).json({ error: 'Forbidden' });

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid ID' });

    const rows = await query('SELECT id FROM attendances WHERE id=?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Attendance not found' });

    await run('UPDATE attendances SET status=? WHERE id=?', ['rejected', id]);
    res.json({ ok: true, message: 'Attendance rejected' });
  } catch (err) {
    console.error('POST /attendances/:id/reject error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==== DELETE (optional, used by your UI) ====
router.delete('/:id', async (req, res) => {
  try {
    const role = req.session?.user?.role;
    if (!role) return res.status(401).json({ error: 'Unauthorized' });
    if (!['hr', 'admin'].includes(role)) return res.status(403).json({ error: 'Forbidden' });

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid ID' });

    const rows = await query('SELECT id FROM attendances WHERE id=?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Attendance not found' });

    await run('DELETE FROM attendances WHERE id=?', [id]);
    res.json({ ok: true, message: 'Attendance deleted' });
  } catch (err) {
    console.error('DELETE /attendances/:id error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
