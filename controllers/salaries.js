// PGS-ERP/controllers/salaries.js
import express from 'express';
import { query, run } from '../db.js';
import { generateSalaryPDF } from '../utils/pdf.js';

const router = express.Router();

// GET all salaries with employee name (for View Salaries)
router.get('/', async (req, res) => {
  try {
    const salaries = await query(`
      SELECT s.*, e.name as employee_name 
      FROM salaries s 
      LEFT JOIN employees e ON s.employee_id = e.id
      ORDER BY s.month DESC, s.id DESC
    `);
    res.json(salaries);
  } catch (err) {
    console.error('Error fetching salaries:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /generate/:employee_id/:month - Generate salary slip
router.post('/generate/:employee_id/:month', async (req, res) => {
  const { employee_id, month } = req.params;
  const { fine = 0, uniform = 0 } = req.body;  // optional extras

  try {
    const eid = Number.parseInt(employee_id, 10);
    if (!Number.isInteger(eid) || eid <= 0) {
      throw new Error('Invalid employee_id');
    }

    // Employee
    const employees = await query('SELECT * FROM employees WHERE id = ?', [eid]);
    const employee = employees[0];
    if (!employee) throw new Error(`Employee ID ${eid} not found`);

    // Month boundaries
    const ym = parseMonth(month);
    if (!ym) throw new Error('Invalid month format: use YYYY-MM');
    const daysInMonth = new Date(ym.y, ym.m, 0).getDate();
    const mm = String(ym.m).padStart(2, '0');
    const startDate = `${ym.y}-${mm}-01`;
    const endDate = `${ym.y}-${mm}-${String(daysInMonth).padStart(2, '0')}`;

    // Attendance (ONLY verified) — present=2 counts as TWO days
    const atts = await query(`
      SELECT SUM(
        CASE 
          WHEN present = 2 THEN 2
          WHEN present = 1 THEN 1
          ELSE 0
        END
      ) AS attendance_days
      FROM attendances a
      WHERE a.employee_id = ? 
        AND date(a.date) BETWEEN date(?) AND date(?)
        AND a.status = 'verified'
    `, [eid, startDate, endDate]);
    const attendance_days = Number(atts[0]?.attendance_days || 0);

    // Deductions for the month
    const deductions = await query(`
      SELECT 
        SUM(CASE WHEN reason = 'Fine' THEN amount ELSE 0 END) AS total_fine,
        SUM(CASE WHEN reason = 'Uniform' THEN amount ELSE 0 END) AS total_uniform,
        SUM(amount) AS total_deductions
      FROM deductions
      WHERE employee_id = ? AND month = ?
    `, [eid, month]);
    const total_fine = Number(deductions[0]?.total_fine || 0);
    const total_uniform = Number(deductions[0]?.total_uniform || 0);
    const total_deductions = Number(deductions[0]?.total_deductions || 0);

    // Salary math
    const monthly_salary = Number.parseFloat(employee.salary_per_month || 0);
    const daily_salary = daysInMonth ? (monthly_salary / daysInMonth) : 0;
    const gross = daily_salary * attendance_days;

    // statutory examples (adjust as needed)
    const pf = gross * 0.12;      // PF 12%
    const esic = gross * 0.0083;  // ESIC 0.83%
    const pt = 200;               // PT flat example

    const extraFine = Number(fine || 0);
    const extraUniform = Number(uniform || 0);

    const combinedDeductions = pf + esic + pt + total_deductions + extraFine + extraUniform;
    const net = gross - combinedDeductions;

    // Client name for PDF (site)
    const client = await query('SELECT name FROM clients WHERE id = (SELECT client_id FROM employees WHERE id = ?)', [eid]);
    const clientName = client[0]?.name || 'N/A';

    // Generate PDF
    const pdfBuffer = await generateSalaryPDF(
      employee,
      month,
      attendance_days,
      daily_salary,
      gross,
      net,
      clientName,
      pf,
      esic,
      pt,
      (total_fine + extraFine),
      (total_uniform + extraUniform),
      daysInMonth
    );

    // Save to DB
    await run(
      'INSERT INTO salaries (employee_id, month, attendance_days, amount, deductions, net_amount) VALUES (?, ?, ?, ?, ?, ?)',
      [eid, month, attendance_days, gross, combinedDeductions, net]
    );

    // Send PDF
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="salary_${eid}_${month}.pdf"`
    });
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Error generating salary:', err);
    res.status(500).json({ error: err.message });
  }
});

// Helper: parse "YYYY-MM"
function parseMonth(monthStr) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(monthStr || '').trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mi = Number(m[2]);
  if (!Number.isInteger(y) || !Number.isInteger(mi) || mi < 1 || mi > 12) return null;
  return { y, m: mi };
}

// ==== GET one salary by ID ====
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid ID' });

    const rows = await query('SELECT * FROM salaries WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Salary not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /salaries/:id error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==== UPDATE one salary (PUT) ====
router.put('/:id', async (req, res) => {
  try {
    const role = req.session?.user?.role;
    if (!role) return res.status(401).json({ error: 'Unauthorized' });
    if (!['admin', 'accountant'].includes(role)) return res.status(403).json({ error: 'Forbidden' });

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid ID' });

    const rows = await query('SELECT * FROM salaries WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Salary not found' });
    const current = rows[0];

    const {
      employee_id = current.employee_id,
      month = current.month,
      attendance_days = current.attendance_days,
      amount = current.amount,
      deductions = current.deductions,
      net_amount = current.net_amount,
      salary_date = current.salary_date
    } = req.body || {};

    await run(
      `UPDATE salaries
          SET employee_id = ?, month = ?, attendance_days = ?, amount = ?, deductions = ?,
              net_amount = ?, salary_date = ?
        WHERE id = ?`,
      [employee_id, month, attendance_days, amount, deductions, net_amount, salary_date, id]
    );

    res.json({ ok: true, message: 'Salary updated' });
  } catch (err) {
    console.error('PUT /salaries/:id error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
