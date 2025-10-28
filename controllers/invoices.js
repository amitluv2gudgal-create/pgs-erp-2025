// PGS-ERP/controllers/invoices.js
import express from 'express';
import { query, run } from '../db.js';
import { generateInvoicePDF, generateAttendanceChartPDF } from '../utils/pdf.js';
import PDFKit from 'pdfkit';                  // for the GET /:id/pdf streaming doc
import { PDFDocument as PDFLib } from 'pdf-lib';  // for in-memory merge on POST


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
    // 4) Append chart pages to invoice (using pdf-lib)
    const mainDoc = await PDFLib.load(
    invoicePDF instanceof Uint8Array ? invoicePDF : new Uint8Array(invoicePDF)
    );
    const chartDoc = await PDFLib.load(
    chartPDF instanceof Uint8Array ? chartPDF : new Uint8Array(chartPDF)
    );
    const chartPages = await mainDoc.copyPages(chartDoc, chartDoc.getPageIndices());
    chartPages.forEach(p => mainDoc.addPage(p));
    const combined = await mainDoc.save();


    // Send combined PDF as base64
    const pdfBase64 = Buffer.from(combined).toString('base64');
    res.json({ id: insertId, pdf: pdfBase64 });

  } catch (err) {
    console.error('Error generating invoice+chart:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==== GET one invoice by ID ====
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

// ==== UPDATE one invoice (PUT, includes tax fields) ====
// Accepts partial updates; unspecified fields keep existing values.
router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid ID' });

    const rows = await query('SELECT * FROM invoices WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Invoice not found' });
    const current = rows[0];

    const {
      client_id = current.client_id,
      month = current.month,
      invoice_no = current.invoice_no,
      subtotal = current.subtotal,
      service_charges = current.service_charges,
      total = current.total,
      cgst_amount = current.cgst_amount,
      sgst_amount = current.sgst_amount,
      grand_total = current.grand_total,
      invoice_date = current.invoice_date
    } = req.body || {};

    await run(
      `UPDATE invoices
          SET client_id = ?, month = ?, invoice_no = ?, subtotal = ?, service_charges = ?,
              total = ?, cgst_amount = ?, sgst_amount = ?, grand_total = ?, invoice_date = ?
        WHERE id = ?`,
      [client_id, month, invoice_no, subtotal, service_charges, total, cgst_amount, sgst_amount, grand_total, invoice_date, id]
    );
    res.json({ ok: true, message: 'Invoice updated' });
  } catch (err) {
    console.error('PUT /invoices/:id error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id/pdf', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const download = String(req.query.download || '') === '1';
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid ID' });

    // 1) Load invoice & client
    const invRows = await query('SELECT * FROM invoices WHERE id = ?', [id]);
    if (!invRows.length) return res.status(404).json({ error: 'Invoice not found' });
    const inv = invRows[0];

    const cliRows = await query('SELECT * FROM clients WHERE id = ?', [inv.client_id]);
    const cli = cliRows[0] || {};

    // 2) Build attendance summary by category for that month (YYYY-MM)
    const month = String(inv.month || '').slice(0, 7); // "YYYY-MM"
    // Join employees+attendances; count present days within the month for this client
    const attSummary = await query(
      `
      SELECT COALESCE(e.category,'Uncategorized') AS category, COUNT(*) AS present_days
      FROM attendances a
      JOIN employees e ON e.id = a.employee_id
      WHERE e.client_id = ?
        AND a.present = 1
        AND substr(a.date,1,7) = ?
      GROUP BY COALESCE(e.category,'Uncategorized')
      ORDER BY category ASC
      `,
      [inv.client_id, month]
    );

    // 3) Start PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename=invoice_${id}.pdf`);
    const doc = new PDFKit({ size: 'A4', margin: 48 });

    doc.pipe(res);

    // ---------- Page 1: Invoice proper ----------
    // Header / Title
    doc.fontSize(18).text('PGS India Pvt. Ltd.', { align: 'right' });
    doc.moveDown(0.2).fontSize(10).text('TAX INVOICE', { align: 'right' });
    doc.moveDown(1);

    doc.fontSize(20).text(`INVOICE #${inv.invoice_no || id}`, { align: 'left' });
    doc.moveDown(0.5);

    // Client block (left) + Invoice meta (right)
    const startY = doc.y;
    doc.fontSize(12).text('Bill To:', { underline: true });
    doc.text(cli.name || 'Client');
    if (cli.address) doc.text(cli.address);
    if (cli.contact) doc.text(`Contact: ${cli.contact}`);
    if (cli.telephone) doc.text(`Phone: ${cli.telephone}`);
    if (cli.email) doc.text(`Email: ${cli.email}`);

    const rightX = 330;
    doc.fontSize(12).text(`Invoice Date: ${inv.invoice_date || new Date().toISOString().slice(0, 10)}`, rightX, startY);
    doc.text(`Month: ${month}`, rightX);
    if (cli.cgst != null) doc.text(`CGST (%): ${cli.cgst}`, rightX);
    if (cli.sgst != null) doc.text(`SGST (%): ${cli.sgst}`, rightX);
    doc.moveDown(1);

    // Amounts table (simple key-value)
    const row = (label, value) => {
      doc.font('Helvetica-Bold').text(label, { continued: true })
         .font('Helvetica').text(`  ${value ?? ''}`);
    };
    row('Subtotal:', inv.subtotal);
    row('Service Charges:', inv.service_charges);
    row('Total:', inv.total);
    row('CGST Amount:', inv.cgst_amount);
    row('SGST Amount:', inv.sgst_amount);
    doc.moveDown(0.4);
    doc.font('Helvetica-Bold').fontSize(14).text(`Grand Total: ${inv.grand_total ?? ''}`);
    doc.moveDown(1.2);

    doc.fontSize(10).text('This is a system generated invoice.', { align: 'center' });
    doc.addPage();

    // ---------- Page 2: Attendance summary chart ----------
    doc.fontSize(16).text(`Attendance Summary — ${cli.name || 'Client'} (${month})`, { align: 'left' });
    doc.moveDown(0.5);

    // Prepare data
    const categories = attSummary.map(r => r.category);
    const values = attSummary.map(r => Number(r.present_days) || 0);
    const maxVal = Math.max(...values, 10); // avoid zero max

    // Chart frame
    const chartX = 60, chartY = 120, chartW = 480, chartH = 240;
    // Axes
    doc.moveTo(chartX, chartY).lineTo(chartX, chartY + chartH).stroke();
    doc.moveTo(chartX, chartY + chartH).lineTo(chartX + chartW, chartY + chartH).stroke();

    // Bars
    const barPad = 10;
    const n = Math.max(values.length, 1);
    const barW = Math.max((chartW - barPad * (n + 1)) / n, 12);

    values.forEach((v, i) => {
      const x = chartX + barPad + i * (barW + barPad);
      const h = Math.round((v / maxVal) * (chartH - 20));
      const y = chartY + chartH - h;

      // bar
      doc.rect(x, y, barW, h).fillOpacity(0.6).fillAndStroke('#000', '#000'); // default color (no specific color styling rule)
      doc.fillOpacity(1).fill('#000');

      // category label (rotated or wrapped)
      const label = String(categories[i] || '').slice(0, 14);
      doc.fontSize(9).text(label, x - 10, chartY + chartH + 4, { width: barW + 20, align: 'center' });
      // value on top
      doc.fontSize(9).text(String(v), x, y - 12, { width: barW, align: 'center' });
    });

    // Y-axis ticks (0, 25%, 50%, 75%, 100%)
    const ticks = 4;
    doc.fontSize(9);
    for (let t = 0; t <= ticks; t++) {
      const val = Math.round((t / ticks) * maxVal);
      const y = chartY + chartH - (t / ticks) * (chartH - 20);
      doc.moveTo(chartX - 4, y).lineTo(chartX, y).stroke();
      doc.text(String(val), chartX - 34, y - 6, { width: 28, align: 'right' });
    }

    doc.moveDown(1.3);

    // Small summary table
    const tableHeaders = ['Category', 'Present Days'];
    const colX = [60, 390];
    const rowH = 18;
    let ty = chartY + chartH + 50;

    // headers
    doc.font('Helvetica-Bold');
    doc.text(tableHeaders[0], colX[0], ty);
    doc.text(tableHeaders[1], colX[1], ty);
    doc.font('Helvetica');
    ty += rowH;

    attSummary.forEach(r => {
      doc.text(String(r.category || ''), colX[0], ty);
      doc.text(String(r.present_days || 0), colX[1], ty);
      ty += rowH;
    });

    doc.end();
  } catch (err) {
    console.error('GET /invoices/:id/pdf error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
