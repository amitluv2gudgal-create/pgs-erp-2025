// PGS-ERP/controllers/deductions.js
import express from 'express';
import { query, run } from '../db.js';

const router = express.Router();

// GET all deductions with employee name
router.get('/', async (req, res) => {
  try {
    const deductions = await query(`
      SELECT d.*, e.name as employee_name 
      FROM deductions d 
      LEFT JOIN employees e ON d.employee_id = e.id
      ORDER BY d.date DESC
    `);
    console.log('Fetched deductions with names:', deductions.length);  // Debug log
    res.json(deductions);
  } catch (err) {
    console.error('Error fetching deductions:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST for creating deduction (unchanged)
router.post('/', async (req, res) => {
  const { employee_id, month, amount, reason } = req.body;
  try {
    if (!employee_id || isNaN(employee_id) || !month || !amount || !reason) {
      throw new Error('Missing or invalid parameters: employee_id, month, amount, and reason are required');
    }

    // Save deduction to database
    await run(
      'INSERT INTO deductions (employee_id, month, amount, reason) VALUES (?, ?, ?, ?)',
      [employee_id, month, amount, reason]
    );
    res.json({ message: 'Deduction created successfully' });
  } catch (err) {
    console.error('Error creating deduction:', err);
    res.status(500).json({ error: err.message });
  }
});

export async function loadDeductions() {
  try {
    const deductions = await query('SELECT d.*, e.name AS employee_name FROM deductions d LEFT JOIN employees e ON d.employee_id = e.id');
    return deductions.map(d => ({
      ...d,
      employee_name: d.employee_name || 'Unknown'
    }));
  } catch (err) {
    console.error('Error fetching deductions:', err);
    throw err;
  }
}

export default router;