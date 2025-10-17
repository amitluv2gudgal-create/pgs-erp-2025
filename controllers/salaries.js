// controllers/salaries.js
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
  // Optional extra deduction buckets the form may pass (not mandatory)
  const { fine = 0, uniform = 0 } = req.body;

  try {
    const eid = Number.parseInt(employee_id, 10);
    if (!Number.isInteger(eid) || eid <= 0) {
      throw new Error('Invalid employee_id');
    }

    // Fetch employee
    const employees = await query('SELECT * FROM employees WHERE id = ?', [eid]);
    const employee = employees[0];
    if (!employee) {
      throw new Error(`Employee ID ${eid} not found`);
    }

    // Parse month and compute boundaries
    const ym = parseMonth(month); // { y, m } where m is 1..12
    if (!ym) throw new Error('Invalid month format: use YYYY-MM');

    // Days in the month: Date(year, monthIndex+1, 0) -> last day of current month
    const daysInMonth = new Date(ym.y, ym.m, 0).getDate();
    const mm = String(ym.m).padStart(2, '0');
    const startDate = `${ym.y}-${mm}-01`;
    const endDate = `${ym.y}-${mm}-${String(daysInMonth).padStart(2, '0')}`;

    // Attendance (ONLY verified)
    const atts = await query(`
      SELECT SUM(CASE WHEN present = 1 THEN 1 ELSE 0 END) AS attendance_days
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

    // statutory examples (adjust as per your policy)
    const pf = gross * 0.12;      // 12% PF
    const esic = gross * 0.0083;  // 0.83% ESIC
    const pt = 200;               // Flat PT example

    const extraFine = Number(fine || 0);
    const extraUniform = Number(uniform || 0);

    const combinedDeductions = pf + esic + pt + total_deductions + extraFine + extraUniform;
    const net = gross - combinedDeductions;

    // Client name (site) if needed in PDF
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

export default router;
