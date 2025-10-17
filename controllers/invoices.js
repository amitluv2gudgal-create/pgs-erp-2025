// PGS-ERP/controllers/invoices.js (robust, month-aware, sum-of-attendance)
import express from 'express';
import { query, run } from '../db.js';
import { generateInvoicePDF } from '../utils/pdf.js';
import { createRequest } from './requests.js';

const router = express.Router();

function parseMonth(monthStr) {
  // expects "YYYY-MM"
  const m = /^(\d{4})-(\d{2})$/.exec(String(monthStr || ''));
  if (!m) return null;
  const y = Number(m[1]);
  const mi = Number(m[2]);
  if (mi < 1 || mi > 12) return null;
  return { y, m: mi };
}

function daysInMonth(y, m1to12) {
  return new Date(y, m1to12, 0).getDate(); // JS trick: day 0 of next month
}

function normKey(s) {
  return String(s || '').trim().toLowerCase();
}

router.get('/', async (req, res) => {
  try {
    const invoices = await query(`
      SELECT i.*, c.name as client_name 
      FROM invoices i 
      LEFT JOIN clients c ON i.client_id = c.id
      ORDER BY i.invoice_date DESC
    `);
    console.log('Fetched invoices with client names:', invoices.length); // Debug log
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
    if (!client_id || isNaN(client_id)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }
    const ym = parseMonth(month);
    if (!ym) {
      return res.status(400).json({ error: 'Invalid month. Use "YYYY-MM".' });
    }

    // Fetch client
    const clients = await query('SELECT * FROM clients WHERE id = ?', [client_id]);
    const client = clients[0];
    if (!client) {
      return res.status(404).json({ error: `Client not found: ${client_id}` });
    }

    // Client categories & monthly rates
    const categories = await query(
      'SELECT category, monthly_rate FROM client_categories WHERE client_id = ?',
      [client_id]
    );
    if (!categories.length) {
      return res.status(400).json({ error: 'No categories found for client. Add client_categories first.' });
    }

    // Build normalized category→monthlyRate map
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

    // Compute date limits for the month
    const dim = daysInMonth(ym.y, ym.m);
    const start = `${ym.y}-${String(ym.m).padStart(2, '0')}-01`;
    const end = `${ym.y}-${String(ym.m).padStart(2, '0')}-${String(dim).padStart(2, '0')}`;

    // Attendance roll-up per category (only verified attendances)
const attRows = await query(`
  WITH base AS (
    SELECT 
      COALESCE(e.category, '') AS emp_category,
      CASE 
        WHEN a.present IN (1, '1', 'true', 'TRUE') THEN 1
        WHEN a.present IS NULL THEN 0
        ELSE CAST(a.present AS REAL)
      END AS present_val
    FROM attendances a 
    JOIN employees e ON e.id = a.employee_id
    WHERE 
      date(a.date) >= date(?)
      AND date(a.date) <= date(?)
      AND e.client_id = ? 
      AND a.status = 'verified'   -- ✅ Only verified attendances
  )
  SELECT emp_category AS category, SUM(COALESCE(present_val, 0)) AS qty
  FROM base
  GROUP BY emp_category
`, [start, end, client_id]);


    // Build categoryData the PDF expects: { [category]: { qty, rate, amount } }
    const categoryData = {};
    let subtotal = 0;

    for (const row of attRows) {
      const rawKey = row.category;
      const key = normKey(rawKey);
      const qty = Number(row.qty || 0);

      if (qty <= 0) {
        continue;
      }

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

      categoryData[rawKey] = {
        qty,
        rate: ratePerDay,
        amount
      };
    }

    if (Object.keys(categoryData).length === 0) {
      return res.status(400).json({
        error: `No attendance found (or categories didn't match rates) for client ${client_id} in ${month}.`
      });
    }

    // Taxes (9% + 9% example)
    const service_charges = 0;
    const total = Number(subtotal.toFixed(2));
    const cgst_amount = Number((total * 0.09).toFixed(2));
    const sgst_amount = Number((total * 0.09).toFixed(2));
    const grand_total = Number((total + cgst_amount + sgst_amount).toFixed(2));

    // Dynamic dates
    const invoiceDate = new Date().toLocaleDateString('en-GB');
    const invoiceMonth = new Date(`${month}-01`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

    // INSERT without invoice_no
   const { insertId } = await run(
  `INSERT INTO invoices 
   (client_id, month, subtotal, service_charges, total, cgst_amount, sgst_amount, grand_total, invoice_date)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  [client_id, month, subtotal, service_charges, total, cgst_amount, sgst_amount, grand_total, invoiceDate]
   );

    // Set invoice_no: provided or auto (insertId as string)
    const finalInvoiceNo = providedInvoiceNo || insertId.toString();
    await run(
      'UPDATE invoices SET invoice_no = ? WHERE id = ?',
      [finalInvoiceNo, insertId]
    );

    // Generate PDF
    const pdfBuffer = await generateInvoicePDF(
      client, month, categoryData, subtotal, service_charges, total, cgst_amount, sgst_amount, grand_total,
      finalInvoiceNo, invoiceDate, invoiceMonth
    );

    // Send as base64 in JSON to match client expectation
    const pdfBase64 = pdfBuffer.toString('base64');
    res.json({ pdf: pdfBase64 });

  } catch (err) {
    console.error('Error generating invoice:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;