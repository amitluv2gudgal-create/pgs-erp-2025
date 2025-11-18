// PGS-ERP/controllers/salaries.js
// import express from 'express';
// import { query, run } from '../db.js';
// import { generateSalaryPDF } from '../utils/pdf.js';

// const router = express.Router();

// // GET all salaries with employee name (for View Salaries)
// router.get('/', async (req, res) => {
//   try {
//     const salaries = await query(`
//       SELECT s.*, e.name as employee_name 
//       FROM salaries s 
//       LEFT JOIN employees e ON s.employee_id = e.id
//       ORDER BY s.month DESC, s.id DESC
//     `);
//     res.json(salaries);
//   } catch (err) {
//     console.error('Error fetching salaries:', err);
//     res.status(500).json({ error: err.message });
//   }
// });

// // POST /generate/:employee_id/:month - Generate salary slip
// router.post('/generate/:employee_id/:month', async (req, res) => {
//   const { employee_id, month } = req.params;
//   const { fine = 0, uniform = 0 } = req.body;  // optional extras

//   try {
//     const eid = Number.parseInt(employee_id, 10);
//     if (!Number.isInteger(eid) || eid <= 0) {
//       throw new Error('Invalid employee_id');
//     }

//     // Employee
//     const employees = await query('SELECT * FROM employees WHERE id = ?', [eid]);
//     const employee = employees[0];
//     if (!employee) throw new Error(`Employee ID ${eid} not found`);

//     // Month boundaries
//     const ym = parseMonth(month);
//     if (!ym) throw new Error('Invalid month format: use YYYY-MM');
//     const daysInMonth = new Date(ym.y, ym.m, 0).getDate();
//     const mm = String(ym.m).padStart(2, '0');
//     const startDate = `${ym.y}-${mm}-01`;
//     const endDate = `${ym.y}-${mm}-${String(daysInMonth).padStart(2, '0')}`;

//     // Attendance (ONLY verified) — present=2 counts as TWO days
//     const atts = await query(`
//       SELECT SUM(
//         CASE 
//           WHEN present = 2 THEN 2
//           WHEN present = 1 THEN 1
//           ELSE 0
//         END
//       ) AS attendance_days
//       FROM attendances a
//       WHERE a.employee_id = ? 
//         AND date(a.date) BETWEEN date(?) AND date(?)
//         AND a.status = 'verified'
//     `, [eid, startDate, endDate]);
//     const attendance_days = Number(atts[0]?.attendance_days || 0);

//     // Deductions for the month
//     const deductions = await query(`
//       SELECT 
//         SUM(CASE WHEN reason = 'Fine' THEN amount ELSE 0 END) AS total_fine,
//         SUM(CASE WHEN reason = 'Uniform' THEN amount ELSE 0 END) AS total_uniform,
//         SUM(amount) AS total_deductions
//       FROM deductions
//       WHERE employee_id = ? AND month = ?
//     `, [eid, month]);
//     const total_fine = Number(deductions[0]?.total_fine || 0);
//     const total_uniform = Number(deductions[0]?.total_uniform || 0);
//     const total_deductions = Number(deductions[0]?.total_deductions || 0);

//     // Salary math
//     const monthly_salary = Number.parseFloat(employee.salary_per_month || 0);
//     const daily_salary = daysInMonth ? (monthly_salary / daysInMonth) : 0;
//     const gross = daily_salary * attendance_days;

//     // statutory examples (adjust as needed)
//     const pf = gross * 0.12;      // PF 12%
//     const esic = gross * 0.0083;  // ESIC 0.83%
//     const pt = 200;               // PT flat example

//     const extraFine = Number(fine || 0);
//     const extraUniform = Number(uniform || 0);

//     const combinedDeductions = pf + esic + pt + total_deductions + extraFine + extraUniform;
//     const net = gross - combinedDeductions;

//     // Client name for PDF (site)
//     const client = await query('SELECT name FROM clients WHERE id = (SELECT client_id FROM employees WHERE id = ?)', [eid]);
//     const clientName = client[0]?.name || 'N/A';

//     // Generate PDF
//     const pdfBuffer = await generateSalaryPDF(
//       employee,
//       month,
//       attendance_days,
//       daily_salary,
//       gross,
//       net,
//       clientName,
//       pf,
//       esic,
//       pt,
//       (total_fine + extraFine),
//       (total_uniform + extraUniform),
//       daysInMonth
//     );

//     // Save to DB
//     await run(
//       'INSERT INTO salaries (employee_id, month, attendance_days, amount, deductions, net_amount) VALUES (?, ?, ?, ?, ?, ?)',
//       [eid, month, attendance_days, gross, combinedDeductions, net]
//     );

//     // Send PDF
//     res.set({
//       'Content-Type': 'application/pdf',
//       'Content-Disposition': `attachment; filename="salary_${eid}_${month}.pdf"`
//     });
//     res.send(pdfBuffer);
//   } catch (err) {
//     console.error('Error generating salary:', err);
//     res.status(500).json({ error: err.message });
//   }
// });

// // Helper: parse "YYYY-MM"
// function parseMonth(monthStr) {
//   const m = /^(\d{4})-(\d{2})$/.exec(String(monthStr || '').trim());
//   if (!m) return null;
//   const y = Number(m[1]);
//   const mi = Number(m[2]);
//   if (!Number.isInteger(y) || !Number.isInteger(mi) || mi < 1 || mi > 12) return null;
//   return { y, m: mi };
// }

// // ==== GET one salary by ID ====
// router.get('/:id', async (req, res) => {
//   try {
//     const id = Number(req.params.id);
//     if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid ID' });

//     const rows = await query('SELECT * FROM salaries WHERE id = ?', [id]);
//     if (!rows.length) return res.status(404).json({ error: 'Salary not found' });
//     res.json(rows[0]);
//   } catch (err) {
//     console.error('GET /salaries/:id error:', err);
//     res.status(500).json({ error: 'Server error' });
//   }
// });

// // ==== UPDATE one salary (PUT) ====
// router.put('/:id', async (req, res) => {
//   try {
//     const role = req.session?.user?.role;
//     if (!role) return res.status(401).json({ error: 'Unauthorized' });
//     if (!['admin', 'accountant'].includes(role)) return res.status(403).json({ error: 'Forbidden' });

//     const id = Number(req.params.id);
//     if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid ID' });

//     const rows = await query('SELECT * FROM salaries WHERE id = ?', [id]);
//     if (!rows.length) return res.status(404).json({ error: 'Salary not found' });
//     const current = rows[0];

//     const {
//       employee_id = current.employee_id,
//       month = current.month,
//       attendance_days = current.attendance_days,
//       amount = current.amount,
//       deductions = current.deductions,
//       net_amount = current.net_amount,
//       salary_date = current.salary_date
//     } = req.body || {};

//     await run(
//       `UPDATE salaries
//           SET employee_id = ?, month = ?, attendance_days = ?, amount = ?, deductions = ?,
//               net_amount = ?, salary_date = ?
//         WHERE id = ?`,
//       [employee_id, month, attendance_days, amount, deductions, net_amount, salary_date, id]
//     );

//     res.json({ ok: true, message: 'Salary updated' });
//   } catch (err) {
//     console.error('PUT /salaries/:id error:', err);
//     res.status(500).json({ error: 'Server error' });
//   }
// });

// export default router;

// controllers/salaries.js
import express from 'express';
import { getDB } from '../db.js';
import { generateSalaryPDF } from '../utils/pdf.js';

const router = express.Router();

const n = v => (v === null || v === undefined || v === '') ? 0 : Number(v);

// POST /generate
router.post('/generate', async (req, res) => {
  try {
    const db = await getDB();
    const body = req.body || {};
    const employee_id = Number(body.employee_id);
    if (!employee_id) return res.status(400).json({ success: false, error: 'employee_id required' });

    const monthInput = body.month ? String(body.month).padStart(2,'0') : String((new Date().getMonth()+1)).padStart(2,'0');
    const month = Number(monthInput);
    const year = Number(body.year) || new Date().getFullYear();
    const daysInMonth = new Date(year, month, 0).getDate();

    // attendance count for 'present' statuses
    const attendanceRows = await db.all(
      `SELECT count(*) as cnt FROM attendances WHERE employee_id = ? AND strftime('%m', date) = ? AND strftime('%Y', date) = ? AND (status = 'present' OR status = 'P' OR status = 'Present')`,
      [employee_id, String(month).padStart(2,'0'), String(year)]
    );
    const attendance_days = (attendanceRows && attendanceRows[0]) ? attendanceRows[0].cnt : 0;

    const employee = await db.get('SELECT * FROM employees WHERE id = ?', [employee_id]);
    if (!employee) return res.status(404).json({ success: false, error: 'employee not found' });

    // other deductions from deductions table for that month/year
    const otherDedsRows = await db.all('SELECT amount FROM deductions WHERE employee_id = ? AND month = ? AND year = ?', [employee_id, String(month).padStart(2,'0'), year]);
    const other_deductions_total = otherDedsRows.reduce((s,r)=> s + Number(r.amount || 0), 0);

    // Components
    const comp_basic = n(employee.basic_rate);
    const comp_da = n(employee.special_allowance);
    const comp_hra = n(employee.hra);
    const comp_ca = n(employee.ca);
    const comp_wa = n(employee.wa);
    const comp_edu = n(employee.educational_allowance);
    const comp_add4 = n(employee.add_4_hours);
    const comp_weeklyoff = n(employee.weekly_off_amount);
    const comp_manual_total = n(employee.salary_total_manual);

    const fallback_monthly = n(employee.salary_per_month);

    const monthly_total_components = comp_manual_total || (comp_basic + comp_da + comp_hra + comp_ca + comp_wa + comp_edu + comp_add4 + comp_weeklyoff);
    const monthly_salary_final = (monthly_total_components > 0) ? monthly_total_components : fallback_monthly;

    const daily_salary = (daysInMonth > 0) ? (monthly_salary_final / daysInMonth) : 0;
    const gross = daily_salary * attendance_days;

    // EPF basis & amount
    const epfOnBasicPlusDa = Number(employee.epf_on_basic_plus_da || 0);
    const epfOnBasic = Number(employee.epf_on_basic || 0);

    let epf_basis_monthly = 0;
    if (epfOnBasicPlusDa === 1) epf_basis_monthly = comp_basic + comp_da;
    else if (epfOnBasic === 1) epf_basis_monthly = comp_basic;
    else epf_basis_monthly = 0;

    const epf_daily_basis = (daysInMonth > 0) ? (epf_basis_monthly / daysInMonth) : 0;
    const EPF_RATE = 0.12; // employee PF share used (change if needed)
    const epf_amount = epf_daily_basis * attendance_days * EPF_RATE;

    // ESIC: 0.75% on gross
    const ESIC_RATE = 0.0075;
    const esic_amount = gross * ESIC_RATE;

    // Professional Tax - Maharashtra slabs (gender sensitive)
    function computeMaharashtraPT(monthlySalary, gender, monthNumber) {
      const m = Number(monthNumber);
      const isFeb = (m === 2);
      if (gender && String(gender).toLowerCase() === 'female') {
        if (monthlySalary <= 25000) return 0;
        return isFeb ? 300 : 200;
      } else {
        if (monthlySalary <= 7500) return 0;
        if (monthlySalary <= 10000) return 175;
        return isFeb ? 300 : 200;
      }
    }

    const professional_tax = computeMaharashtraPT(monthly_salary_final, employee.gender, month);

    // Extra fines/uniform are not in this logic - default 0; other deductions from table included
    const extraFine = 0;
    const extraUniform = 0;

    const combinedDeductions = epf_amount + esic_amount + professional_tax + other_deductions_total + extraFine + extraUniform;
    const net = gross - combinedDeductions;

    const breakdown = {
      components: {
        basic: comp_basic, da: comp_da, hra: comp_hra, ca: comp_ca, wa: comp_wa,
        educational_allowance: comp_edu, add_4_hours: comp_add4, weekly_off_amount: comp_weeklyoff,
        manual_total: comp_manual_total, fallback_monthly
      },
      computed: {
        daysInMonth, attendance_days, daily_salary, gross
      },
      deductions: {
        epf_amount, esic_amount, professional_tax, other_deductions_total, extra_fine: extraFine, extra_uniform: extraUniform
      }
    };

    const insert = await db.run(
      `INSERT INTO salaries (employee_id, month, year, days_in_month, attendance_days, gross, total_deductions, net, breakdown)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        employee_id,
        String(month).padStart(2,'0'),
        year,
        daysInMonth,
        attendance_days,
        gross,
        combinedDeductions,
        net,
        JSON.stringify(breakdown)
      ]
    );

    res.json({
      success: true,
      id: insert.lastID,
      employee_id,
      month: String(month).padStart(2,'0'),
      year,
      daysInMonth,
      attendance_days,
      gross,
      deductions: {
        epf: epf_amount,
        esic: esic_amount,
        professional_tax,
        other: other_deductions_total
      },
      net,
      breakdown
    });

  } catch (err) {
    console.error('salary generate err', err);
    res.status(500).json({ success: false, error: String(err) });
  }
});

// GET preview PDF inline: /api/salaries/:id/pdf
router.get('/:id/pdf', async (req, res) => {
  try {
    const db = await getDB();
    const salaryId = Number(req.params.id);
    if (!salaryId) return res.status(400).json({ success: false, error: 'invalid salary id' });

    const salary = await db.get('SELECT * FROM salaries WHERE id = ?', [salaryId]);
    if (!salary) return res.status(404).json({ success: false, error: 'salary record not found' });

    const employee = await db.get('SELECT * FROM employees WHERE id = ?', [salary.employee_id]);
    if (!employee) return res.status(404).json({ success: false, error: 'employee not found' });

    let clientName = '';
    if (employee.client_id) {
      const client = await db.get('SELECT * FROM clients WHERE id = ?', [employee.client_id]);
      clientName = client ? client.name : '';
    }

    let salaryRecord = { ...salary };
    try {
      if (salaryRecord.breakdown && typeof salaryRecord.breakdown === 'string') salaryRecord.breakdown = JSON.parse(salaryRecord.breakdown);
    } catch (e) { /* ignore */ }

    const pdfBuffer = await generateSalaryPDF(employee, salaryRecord, clientName);

    res.setHeader('Content-Type', 'application/pdf');
    const filename = `SalarySlip_emp${employee.id}_salary${salaryId}.pdf`;
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('error generating salary pdf', err);
    return res.status(500).json({ success: false, error: String(err) });
  }
});

// GET download PDF: /api/salaries/:id/download
router.get('/:id/download', async (req, res) => {
  try {
    const db = await getDB();
    const salaryId = Number(req.params.id);
    if (!salaryId) return res.status(400).json({ success: false, error: 'invalid salary id' });

    const salary = await db.get('SELECT * FROM salaries WHERE id = ?', [salaryId]);
    if (!salary) return res.status(404).json({ success: false, error: 'salary record not found' });

    const employee = await db.get('SELECT * FROM employees WHERE id = ?', [salary.employee_id]);
    if (!employee) return res.status(404).json({ success: false, error: 'employee not found' });

    let clientName = '';
    if (employee.client_id) {
      const client = await db.get('SELECT * FROM clients WHERE id = ?', [employee.client_id]);
      clientName = client ? client.name : '';
    }

    let salaryRecord = { ...salary };
    try {
      if (salaryRecord.breakdown && typeof salaryRecord.breakdown === 'string') salaryRecord.breakdown = JSON.parse(salaryRecord.breakdown);
    } catch (e) { /* ignore */ }

    const pdfBuffer = await generateSalaryPDF(employee, salaryRecord, clientName);

    res.setHeader('Content-Type', 'application/pdf');
    const filename = `SalarySlip_emp${employee.id}_salary${salaryId}.pdf`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('error generating salary pdf (download)', err);
    return res.status(500).json({ success: false, error: String(err) });
  }
});

export default router;

