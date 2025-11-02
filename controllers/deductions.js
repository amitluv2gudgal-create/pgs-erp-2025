// PGS-ERP/controllers/deductions.js
import express from 'express';
import { query, run } from '../db.js';

const router = express.Router();

// GET all deductions with employee name
router.get('/', async (req, res) => {
  try {
    // Return common join to include employee name (if you already do that adjust accordingly)
    const rows = await db.all(`
  SELECT id, employee_id, amount, reason, month, note
  FROM deductions
  ORDER BY id DESC
`);
res.json(rows);

  } catch (err) {
    console.error('GET /api/deductions error', err);
    res.status(500).json({ error: err.message });
  }
});

// Get single deduction
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const rows = await query('SELECT * FROM deductions WHERE id = ?', [id]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /api/deductions/:id error', err);
    res.status(500).json({ error: err.message });
  }
});

// Create deduction
router.post('/', async (req, res) => {
  try {
    const { employee_id, month, reason, amount, note } = req.body;

    // Basic validation (adjust role check if required)
    if (!employee_id || !month || !reason || !note || !(amount > 0)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const dateNow = new Date().toISOString();
    const result = await run(
      `INSERT INTO deductions (employee_id, amount, reason, date, month, note)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [employee_id, amount, reason, dateNow, month, note ?? null]
    );

    // result.lastID depends on your db wrapper; adjust accordingly
    const insertedId = result?.lastID ?? null;
    res.status(201).json({ ok: true, id: insertedId });
  } catch (err) {
    console.error('POST /api/deductions error', err);
    res.status(500).json({ error: err.message });
  }
});

// Update deduction
router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { employee_id, amount, reason, date, month, note } = req.body;

    await run(
      `UPDATE deductions SET employee_id = ?, amount = ?, reason = ?, date = ?, month = ?, note = ? WHERE id = ?`,
      [employee_id, amount, reason, date || null, month || null, note ?? null, id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/deductions/:id error', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete deduction (if you have it)
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await run('DELETE FROM deductions WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/deductions/:id error', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;