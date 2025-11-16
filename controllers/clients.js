// controllers/clients.js
import express from 'express';
import { query, run } from '../db.js';
import { createRequest } from './requests.js';

const router = express.Router();

// Helper: ensure numeric ID
const toId = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

// GET all clients
router.get('/', async (req, res) => {
  try {
    const clients = await query('SELECT * FROM clients ORDER BY id DESC');
    // Attach categories
    for (let client of clients) {
      try {
        const cats = await query('SELECT category, monthly_rate FROM client_categories WHERE client_id = ?', [client.id]);
        client.categories = cats.length > 0 ? cats.map(c => `${c.category}: ₹${c.monthly_rate}`).join(', ') : 'No categories';
      } catch (catErr) {
        console.warn(`No categories found for client ${client.id}:`, catErr.message);
        client.categories = 'No categories';
      }
    }
    res.json(clients);
  } catch (err) {
    console.error('Error fetching clients:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create client (accountant only)
router.post('/', async (req, res) => {
  try {
    if (req.session.user.role !== 'accountant') return res.status(403).json({ error: 'Forbidden' });

    // Accept new fields from body
    const {
      name,
      address_line1,
      address_line2,
      contact_person,
      state,
      district,
      po_order,
      telephone,
      email,
      cgst = 0,
      sgst = 0,
      igst = 0
    } = req.body || {};

    if (!name || !address_line1) return res.status(400).json({ error: 'name and address_line1 required' });

    const { id } = await run(
      `INSERT INTO clients 
        (name, address_line1, address_line2, contact_person, state, district, po_order, telephone, email, cgst, sgst, igst)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, address_line1, address_line2, contact_person, state, district, po_order, telephone, email, cgst, sgst, igst]
    );

    res.json({ id });
  } catch (err) {
    console.error('POST /clients error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Add category to client (accountant)
router.post('/:id/categories', async (req, res) => {
  try {
    if (req.session.user.role !== 'accountant') return res.status(403).json({ error: 'Forbidden' });
    const { category, monthly_rate } = req.body;
    const clientId = toId(req.params.id);
    if (!clientId) return res.status(400).json({ error: 'Invalid client id' });
    await run('INSERT INTO client_categories (client_id, category, monthly_rate) VALUES (?, ?, ?)', [clientId, category, monthly_rate]);
    res.json({ success: true });
  } catch (err) {
    console.error('POST /clients/:id/categories error:', err);
    res.status(500).json({ error: err.message });
  }
});

export async function loadClients() {
  try {
    const response = await fetch('/api/clients', { credentials: 'include' });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const clients = await response.json();
    console.log('Loaded clients:', clients);
    return clients;
  } catch (err) {
    console.error('Error loading clients:', err);
    return [];
  }
}

// Edit client (request approval if not admin)
router.put('/:id', async (req, res) => {
  try {
    const role = req.session.user.role;
    if (role === 'admin') return res.status(403).json({ error: 'Admin cannot edit directly' });
    if (role !== 'accountant') return res.status(403).json({ error: 'Forbidden' });

    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });

    await createRequest(req.session.user.id, 'edit', 'clients', id, JSON.stringify(req.body));
    res.json({ success: true, message: 'Edit request created' });
  } catch (err) {
    console.error('PUT /clients/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete client (request approval)
router.delete('/:id', async (req, res) => {
  try {
    const role = req.session.user.role;
    if (role === 'admin') return res.status(403).json({ error: 'Admin cannot delete directly' });
    if (role !== 'accountant') return res.status(403).json({ error: 'Forbidden' });

    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid id' });

    await createRequest(req.session.user.id, 'delete', 'clients', id, null);
    res.json({ success: true, message: 'Delete request created' });
  } catch (err) {
    console.error('DELETE /clients/:id error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get single client by ID (for edit modal pre-fill)
router.get('/:id/direct', async (req, res) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid ID' });
    const rows = await query('SELECT * FROM clients WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Client not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /clients/:id/direct error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update client directly (admin only)
router.put('/:id/direct', async (req, res) => {
  try {
    if (req.session.user.role !== 'admin') return res.status(403).json({ error: 'Only admin can edit directly' });

    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid ID' });

    const rows = await query('SELECT * FROM clients WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Client not found' });
    const current = rows[0];

    const {
      name = current.name,
      address_line1 = current.address_line1,
      address_line2 = current.address_line2,
      contact_person = current.contact_person,
      state = current.state,
      district = current.district,
      po_order = current.po_order,
      telephone = current.telephone,
      email = current.email,
      cgst = current.cgst,
      sgst = current.sgst,
      igst = current.igst
    } = req.body || {};

    await run(
      `UPDATE clients
         SET name = ?, address_line1 = ?, address_line2 = ?, contact_person = ?,
             state = ?, district = ?, po_order = ?, telephone = ?, email = ?,
             cgst = ?, sgst = ?, igst = ?
       WHERE id = ?`,
      [name, address_line1, address_line2, contact_person, state, district, po_order, telephone, email, cgst, sgst, igst, id]
    );

    res.json({ ok: true, message: 'Client updated directly' });
  } catch (err) {
    console.error('PUT /clients/:id/direct error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET one client by ID (for display)
router.get('/:id', async (req, res) => {
  try {
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid ID' });
    const rows = await query('SELECT * FROM clients WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Client not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /clients/:id error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
