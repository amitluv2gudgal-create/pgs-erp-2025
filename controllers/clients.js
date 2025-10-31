// controllers/clients.js
import express from 'express';
import { query, run } from '../db.js';

const router = express.Router();

// Get all clients (include categories summary)
router.get('/', async (_req, res) => {
  try {
    const clients = await query('SELECT * FROM clients ORDER BY id DESC');
    for (const client of clients) {
      try {
        const cats = await query(
          'SELECT category, monthly_rate FROM client_categories WHERE client_id = ?',
          [client.id]
        );
        client.categories = cats.length
          ? cats.map(c => `${c.category}: ₹${c.monthly_rate}`).join(', ')
          : 'No categories';
      } catch (e) {
        client.categories = 'No categories';
      }
    }
    res.json(clients);
  } catch (err) {
    console.error('Error fetching clients:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// Create client (admin/accountant)
router.post('/', async (req, res) => {
  try {
    if (!req.session?.user || !['admin', 'accountant'].includes(req.session.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const {
      name,
      address_line1,
      address_line2,
      po_dated,
      state,
      district,
      telephone,
      email,
      gst_number,
      cgst = 0,
      sgst = 0,
      igst = 0
    } = req.body || {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Client name is required' });
    }

    // Use parameterized insert
    const sql = `INSERT INTO clients
      (name, address_line1, address_line2, po_dated, state, district, telephone, email, gst_number, cgst, sgst, igst)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const params = [
      String(name).trim(),
      address_line1 || null,
      address_line2 || null,
      po_dated || null,
      state || null,
      district || null,
      telephone || null,
      email || null,
      gst_number || null,
      Number(cgst) || 0,
      Number(sgst) || 0,
      (typeof igst !== 'undefined' && igst !== null && igst !== '') ? Number(igst) : null
    ];

    const insertResult = await run(sql, params);

    // run wrappers differ: try common return shapes
    const insertId = insertResult?.lastID ?? insertResult?.insertId ?? insertResult?.id ?? null;

    if (!insertId) {
      // best-effort: if no insertId, try to find by unique fields (name + telephone + email) as a fallback
      const fallbackRows = await query(
        `SELECT * FROM clients WHERE name = ? AND (telephone = ? OR email = ?) ORDER BY id DESC LIMIT 1`,
        [String(name).trim(), telephone || '', email || '']
      );
      if (fallbackRows && fallbackRows.length) {
        return res.status(201).json(fallbackRows[0]);
      }
      // otherwise return success without object
      return res.status(201).json({ ok: true });
    }

    const rows = await query('SELECT * FROM clients WHERE id = ?', [insertId]);
    return res.status(201).json(rows[0] || { ok: true, id: insertId });
  } catch (err) {
    console.error('Create client error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
});

// Add category to client (admin/accountant)
router.post('/:id/categories', async (req, res) => {
  try {
    if (!req.session?.user || !['admin', 'accountant'].includes(req.session.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const id = Number(req.params.id);
    const { category, monthly_rate } = req.body || {};
    if (!id || !category || typeof monthly_rate === 'undefined') {
      return res.status(400).json({ error: 'Client ID, category and monthly_rate are required' });
    }
    await run(
      'INSERT INTO client_categories (client_id, category, monthly_rate) VALUES (?, ?, ?)',
      [id, String(category).trim(), Number(monthly_rate)]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Add category error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// Get one client by ID
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid ID' });
    const rows = await query('SELECT * FROM clients WHERE id = ?', [id]);
    if (!rows || !rows.length) return res.status(404).json({ error: 'Client not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /clients/:id error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// Update client (admin/accountant)
router.put('/:id', async (req, res) => {
  try {
    if (!req.session?.user || !['admin', 'accountant'].includes(req.session.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid ID' });

    const currentRows = await query('SELECT * FROM clients WHERE id = ?', [id]);
    if (!currentRows || !currentRows.length) return res.status(404).json({ error: 'Client not found' });
    const current = currentRows[0];

    const {
      name = current.name,
      address_line1 = current.address_line1,
      address_line2 = current.address_line2,
      po_dated = current.po_dated,
      state = current.state,
      district = current.district,
      telephone = current.telephone,
      email = current.email,
      gst_number = current.gst_number,
      cgst = current.cgst,
      sgst = current.sgst,
      igst = current.igst
    } = req.body || {};

    await run(
      `UPDATE clients
         SET name = ?, address_line1 = ?, address_line2 = ?, po_dated = ?,
             state = ?, district = ?, telephone = ?, email = ?, gst_number = ?, cgst = ?, sgst = ?, igst = ?
       WHERE id = ?`,
      [
        String(name).trim(),
        (address_line1 || null),
        (address_line2 || null),
        (po_dated || null),
        (state || null),
        (district || null),
        (telephone || null),
        (email || null),
        gst_number || null,
        Number(cgst) || 0,
        Number(sgst) || 0,
        (typeof igst !== 'undefined' && igst !== null && igst !== '') ? Number(igst) : null,
        id
      ]
    );

    const rows = await query('SELECT * FROM clients WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /clients/:id error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// Delete client (admin/accountant)
router.delete('/:id', async (req, res) => {
  try {
    if (!req.session?.user || !['admin', 'accountant'].includes(req.session.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid ID' });

    await run('DELETE FROM clients WHERE id = ?', [id]);
    await run('DELETE FROM client_categories WHERE client_id = ?', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /clients/:id error:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

export default router;
