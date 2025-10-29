// PGS-ERP/controllers/invoices.js
import express from 'express';
import { query, run } from '../db.js';
import { generateInvoicePDF, generateAttendanceChartPDF } from '../utils/pdf.js';
import { PDFDocument as PDFLib } from 'pdf-lib';

const router = express.Router();

function parseMonth(monthStr) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(monthStr || ''));
  if (!m) return null;
  const y = Number(m[1]); const mon = Number(m[2]);
  if (mon < 1 || mon > 12) return null;
  return { y, m: mon };
}
function daysInMonth(y, m1to12) { return new Date(y, m1to12, 0).getDate(); }
const norm = s => String(s || '').trim().toLowerCase();

// --- Shared helpers ---------------------------------------------------------
async function getClientAndMonthWindow(client_id, month) {
  const ym = parseMonth(month);
  if (!ym) throw new Error('Invalid month. Use "YYYY-MM".');
  const dim = daysInMonth(ym.y, ym.m);
  const start = `${ym.y}-${String(ym.m).padStart(2, '0')}-01`;
  const end   = `${ym.y}-${String(ym.m).padStart(2, '0')}-${String(dim).padStart(2, '0')}`;

  const clients = await query('SELECT * FROM clients WHERE id = ?', [client_id]);
  const client = clients[0];
  if (!client) throw new Error(`Client not found: ${client_id}`);

  return { client, start, end, dim, ym };
}

async function buildCategoryTable(client_id, start, end, dim) {
  // Get monthly category rates
  const categories = await query(
    'SELECT category, monthly_rate FROM client_categories WHERE client_id = ?',
    [client_id]
  );
  const catMonthly = {};
  for (const c of categories) catMonthly[norm(c.category)] = Number(c.monthly_rate);

  // Roll up verified attendance per category
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
      WHERE date(a.date) BETWEEN date(?) AND date(?)
        AND e.client_id = ?
        AND a.status = 'verified'
    )
    SELECT emp_category AS category, SUM(COALESCE(present_val, 0)) AS qty
    FROM base
    GROUP BY emp_category
  `, [start, end, client_id]);

  const categoryData = {};
  let subtotal = 0;

  for (const row of attRows) {
    const rawKey = row.category || '';
    const qty = Number(row.qty || 0);
    if (qty <= 0) continue;

    const monthlyRate = catMonthly[norm(rawKey)];
    if (!isFinite(monthlyRate) || monthlyRate <= 0) continue;

    const ratePerDay = Number((monthlyRate / dim).toFixed(2));
    const amount = Number((qty * ratePerDay).toFixed(2));
    subtotal += amount;
    categoryData[rawKey] = { qty, rate: ratePerDay, amount };
  }
  return { categoryData, subtotal };
}

async function buildAttendanceMap(client_id, start, end) {
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

  const presentByEmp = new Map();
  for (const e of employees) presentByEmp.set(e.id, new Map());
  for (const r of aRows) {
    const iso = String(r.date).slice(0, 10);
    const val = Number(r.present) || 0;
    if (!presentByEmp.has(r.employee_id)) presentByEmp.set(r.employee_id, new Map());
    presentByEmp.get(r.employee_id).set(iso, val);
  }
  return { employees, presentByEmp };
}

async function mergeInvoiceAndChart(invoicePDF, chartPDF) {
  const mainDoc = await PDFLib.load(invoicePDF instanceof Uint8Array ? invoicePDF : new Uint8Array(invoicePDF));
  const chartDoc = await PDFLib.load(chartPDF instanceof Uint8Array ? chartPDF : new Uint8Array(chartPDF));
  const chartPages = await mainDoc.copyPages(chartDoc, chartDoc.getPageIndices());
  chartPages.forEach(p => mainDoc.addPage(p));
  return await mainDoc.save();
}

// --- Routes ------------------------------------------------------------------

// List
router.get('/', async (_req, res) => {
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

// Create (generate legacy invoice + attendance chart; return id + base64)
router.post('/', async (req, res) => {
  try {
    if (!req.session?.user || req.session.user.role !== 'accountant') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { client_id, month, invoice_no: providedInvoiceNo } = req.body;
    if (!client_id || isNaN(client_id)) return res.status(400).json({ error: 'Invalid client ID' });

    const { client, start, end, dim, ym } = await getClientAndMonthWindow(client_id, month);

    // Build categories from attendance
    const { categoryData, subtotal } = await buildCategoryTable(client_id, start, end, dim);
    if (Object.keys(categoryData).length === 0) {
      return res.status(400).json({
        error: `No verified attendance (or categories missing rates) for client ${client_id} in ${month}.`
      });
    }

    // Totals (you can adjust tax % from client profile if needed)
    const service_charges = 0;
    const total = Number(subtotal.toFixed(2));
    const cgst_amount = Number((total * 0.09).toFixed(2));
    const sgst_amount = Number((total * 0.09).toFixed(2));
    const grand_total = Number((total + cgst_amount + sgst_amount).toFixed(2));

    const invoiceDate = new Date().toLocaleDateString('en-GB');
    const invoiceMonth = new Date(`${month}-01`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

    // Insert and set invoice_no
    const { insertId } = await run(
      `INSERT INTO invoices (client_id, month, subtotal, service_charges, total, cgst_amount, sgst_amount, grand_total, invoice_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [client_id, month, subtotal, service_charges, total, cgst_amount, sgst_amount, grand_total, invoiceDate]
    );
    const finalInvoiceNo = providedInvoiceNo || String(insertId);
    await run('UPDATE invoices SET invoice_no = ? WHERE id = ?', [finalInvoiceNo, insertId]);

    // Generate PDFs (legacy invoice + chart)
    const invoicePDF = await generateInvoicePDF(
      client, month, categoryData, subtotal, service_charges, total, cgst_amount, sgst_amount, grand_total,
      finalInvoiceNo, invoiceDate, invoiceMonth
    );

    const { employees, presentByEmp } = await buildAttendanceMap(client_id, start, end);
    const chartPDF = await generateAttendanceChartPDF({
      client, month, employees, daysInMonth: dim, presentByEmp
    });

    const combined = await mergeInvoiceAndChart(invoicePDF, chartPDF);
    const pdfBase64 = Buffer.from(combined).toString('base64');
    return res.json({ id: insertId, pdf: pdfBase64 });
  } catch (err) {
    console.error('Error generating invoice+chart:', err);
    res.status(500).json({ error: err.message });
  }
});

// Read one
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid ID' });
    const rows = await query('SELECT * FROM invoices WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Invoice not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /invoices/:id error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Stream (legacy invoice + attendance chart)
router.get('/:id/pdf', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const download = String(req.query.download || '') === '1';
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid ID' });

    const invRows = await query('SELECT * FROM invoices WHERE id = ?', [id]);
    if (!invRows.length) return res.status(404).json({ error: 'Invoice not found' });
    const inv = invRows[0];

    const { client, start, end, dim } = await getClientAndMonthWindow(inv.client_id, String(inv.month).slice(0, 7));

    // Recompute categories for the legacy template lines
    const { categoryData } = await buildCategoryTable(inv.client_id, start, end, dim);

    const invoiceDate = inv.invoice_date || new Date().toLocaleDateString('en-GB');
    const invoiceMonth = new Date(`${String(inv.month).slice(0, 7)}-01`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

    const invoicePDF = await generateInvoicePDF(
      client,
      String(inv.month).slice(0, 7),
      categoryData,
      Number(inv.subtotal || 0),
      Number(inv.service_charges || 0),
      Number(inv.total || 0),
      Number(inv.cgst_amount || 0),
      Number(inv.sgst_amount || 0),
      Number(inv.grand_total || 0),
      String(inv.invoice_no || id),
      invoiceDate,
      invoiceMonth
    );

    const { employees, presentByEmp } = await buildAttendanceMap(inv.client_id, start, end);
    const chartPDF = await generateAttendanceChartPDF({
      client, month: String(inv.month).slice(0, 7), employees, daysInMonth: dim, presentByEmp
    });

    const merged = await mergeInvoiceAndChart(invoicePDF, chartPDF);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `${download ? 'attachment' : 'inline'}; filename=invoice_${id}.pdf`
    );
    res.end(Buffer.from(merged));
  } catch (err) {
    console.error('GET /invoices/:id/pdf error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
