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
      } catch {
        client.categories = 'No categories';
      }
    }
    res.json(clients);
  } catch (err) {
    console.error('Error fetching clients:', err);
    res.status(500).json({ error: err.message });
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

    const { insertId } = await run(
      `INSERT INTO clients
        (name, address_line1, address_line2, po_dated, state, district, telephone, email, gst_number, cgst, sgst, igst)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
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
        Number(igst) || 0
      ]
    );

    const rows = await query('SELECT * FROM clients WHERE id = ?', [insertId]);
    res.json(rows[0]);
  } catch (err) {
    console.error('Create client error:', err);
    res.status(500).json({ error: err.message });
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
    if (!id || !category || !monthly_rate) {
      return res.status(400).json({ error: 'Client ID, category and monthly_rate are required' });
    }
    await run(
      'INSERT INTO client_categories (client_id, category, monthly_rate) VALUES (?, ?, ?)',
      [id, String(category).trim(), Number(monthly_rate)]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('Add category error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get one client by ID
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid ID' });
    const rows = await query('SELECT * FROM clients WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Client not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /clients/:id error:', err);
    res.status(500).json({ error: 'Server error' });
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
    if (!currentRows.length) return res.status(404).json({ error: 'Client not found' });
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
        number(igst) || 0,
        id
      ]
    );

    const rows = await query('SELECT * FROM clients WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (err) {
    console.error('PUT /clients/:id error:', err);
    res.status(500).json({ error: 'Server error' });
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
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
