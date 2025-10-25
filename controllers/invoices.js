// PGS-ERP/controllers/invoices.js
import express from 'express';
import { query, run } from '../db.js';
import { generateInvoicePDF, generateAttendanceChartPDF } from '../utils/pdf.js';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const router = express.Router();

function parseMonth(monthStr) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(monthStr || ''));
  if (!m) return null;
  const y = Number(m[1]);
  const mi = Number(m[2]);
  if (mi < 1 || mi > 12) return null;
  return { y, m: mi };
}
function daysInMonth(y, m1to12) { return new Date(y, m1to12, 0).getDate(); }
function normKey(s) { return String(s || '').trim().toLowerCase(); }

router.get('/', async (req, res) => {
  try {
    const invoices = await query(`
      SELECT i.*, c.name as client_name 
      FROM invoices i 
      LEFT JOIN clients c ON i.client_id = c.id
      ORDER BY i.invoice_date DESC
    `);
    res.json(invoices);
  } catch (err) {
    console.error('Error fetching invoices:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    if (!req.session?.user || req.session.user.role !== 'accountant') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { client_id, month, invoice_no: providedInvoiceNo } = req.body;
    if (!client_id || isNaN(client_id)) return res.status(400).json({ error: 'Invalid client ID' });

    const ym = parseMonth(month);
    if (!ym) return res.status(400).json({ error: 'Invalid month. Use "YYYY-MM".' });

    // Client
    const clients = await query('SELECT * FROM clients WHERE id = ?', [client_id]);
    const client = clients[0];
    if (!client) return res.status(404).json({ error: `Client not found: ${client_id}` });

    // Categories & monthly rates
    const categories = await query(
      'SELECT category, monthly_rate FROM client_categories WHERE client_id = ?',
      [client_id]
    );
    if (!categories.length) {
      return res.status(400).json({ error: 'No categories found for client. Add client_categories first.' });
    }
    const catMonthly = {};
    for (const c of categories) {
      const key = normKey(c.category);
      const mr = Number(c.monthly_rate);
      if (!isFinite(mr) || mr <= 0) {
        return res.status(400).json({
          error: `Monthly rate for category "${c.category}" is missing/invalid for client ${client_id}.`
        });
      }
      catMonthly[key] = mr;
    }

    // Month bounds
    const dim = daysInMonth(ym.y, ym.m);
    const start = `${ym.y}-${String(ym.m).padStart(2, '0')}-01`;
    const end   = `${ym.y}-${String(ym.m).padStart(2, '0')}-${String(dim).padStart(2, '0')}`;

    // Attendance roll-up per category (ONLY verified)
    // NOTE: present=2 counts as TWO days; present=1 counts as ONE day.
    const attRows = await query(`
      WITH base AS (
        SELECT 
          COALESCE(e.category, '') AS emp_category,
          CASE 
            WHEN a.present IN (2, '2') THEN 2
            WHEN a.present IN (1, '1', 'true', 'TRUE') THEN 1
            ELSE 0
          END AS present_val
        FROM attendances a 
        JOIN employees e ON e.id = a.employee_id
        WHERE 
          date(a.date) >= date(?)
          AND date(a.date) <= date(?)
          AND e.client_id = ?
          AND a.status = 'verified'
      )
      SELECT emp_category AS category, SUM(COALESCE(present_val, 0)) AS qty
      FROM base
      GROUP BY emp_category
    `, [start, end, client_id]);

    // Build invoice category data
    const categoryData = {};
    let subtotal = 0;
    for (const row of attRows) {
      const rawKey = row.category;
      const key = normKey(rawKey);
      const qty = Number(row.qty || 0);
      if (qty <= 0) continue;

      const monthlyRate = catMonthly[key];
      if (monthlyRate == null) {
        console.warn(`No matching monthly rate for category "${rawKey}" (normalized "${key}")`);
        continue;
      }

      const ratePerDay = Number((monthlyRate / dim).toFixed(2));
      if (!isFinite(ratePerDay) || ratePerDay <= 0) {
        return res.status(400).json({
          error: `Calculated per-day rate invalid for "${rawKey}". monthlyRate=${monthlyRate}, daysInMonth=${dim}`
        });
      }

      const amount = Number((qty * ratePerDay).toFixed(2));
      subtotal += amount;
      categoryData[rawKey] = { qty, rate: ratePerDay, amount };
    }

    if (Object.keys(categoryData).length === 0) {
      return res.status(400).json({
        error: `No verified attendance found (or categories didn't match rates) for client ${client_id} in ${month}.`
      });
    }

    // Taxes (adjust to your policy)
    const service_charges = 0;
    const total = Number(subtotal.toFixed(2));
    const cgst_amount = Number((total * 0.09).toFixed(2));
    const sgst_amount = Number((total * 0.09).toFixed(2));
    const grand_total = Number((total + cgst_amount + sgst_amount).toFixed(2));

    const invoiceDate = new Date().toLocaleDateString('en-GB');
    const invoiceMonth = new Date(`${month}-01`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

    // INSERT invoice (without number)
    const { insertId } = await run(
      `INSERT INTO invoices 
       (client_id, month, subtotal, service_charges, total, cgst_amount, sgst_amount, grand_total, invoice_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [client_id, month, subtotal, service_charges, total, cgst_amount, sgst_amount, grand_total, invoiceDate]
    );

    // invoice_no
    const finalInvoiceNo = providedInvoiceNo || insertId.toString();
    await run('UPDATE invoices SET invoice_no = ? WHERE id = ?', [finalInvoiceNo, insertId]);

    // 1) Standard invoice PDF
    const invoicePDF = await generateInvoicePDF(
      client, month, categoryData, subtotal, service_charges, total, cgst_amount, sgst_amount, grand_total,
      finalInvoiceNo, invoiceDate, invoiceMonth
    );

    // 2) Attendance chart data
    const employees = await query(
      'SELECT id, name FROM employees WHERE client_id = ? ORDER BY name ASC',
      [client_id]
    );

    const aRows = await query(
      `SELECT employee_id, date, present 
       FROM attendances 
       WHERE client_id = ? AND date BETWEEN ? AND ? AND status = 'verified'`,
      [client_id, start, end]
    );

    // Map<empId, Map<isoDate, 0|1|2>>
    const presentByEmp = new Map();
    for (const e of employees) presentByEmp.set(e.id, new Map());
    for (const r of aRows) {
      const iso = String(r.date).slice(0, 10);
      const val = Number(r.present) || 0;     // 0|1|2
      if (!presentByEmp.has(r.employee_id)) presentByEmp.set(r.employee_id, new Map());
      presentByEmp.get(r.employee_id).set(iso, val);
    }

    // 3) Attendance chart PDF (landscape)
    const chartPDF = await generateAttendanceChartPDF({
      client, month, employees, daysInMonth: dim, presentByEmp
    });

    // 4) Append chart pages to invoice
    const mainDoc = await ( PDFDocument, StandardFonts, rgb ).load(invoicePDF);
    const chartDoc = await ( PDFDocument, StandardFonts, rgb ).load(chartPDF);
    const chartPages = await mainDoc.copyPages(chartDoc, chartDoc.getPageIndices());
    chartPages.forEach(p => mainDoc.addPage(p));
    const combined = await mainDoc.save();

    // Send combined PDF as base64
    const pdfBase64 = Buffer.from(combined).toString('base64');
    res.json({ pdf: pdfBase64 });

  } catch (err) {
    console.error('Error generating invoice+chart:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
