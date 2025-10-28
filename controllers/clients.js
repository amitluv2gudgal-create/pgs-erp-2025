// controllers/clients.js
import express from 'express';
import { query, run } from '../db.js';
import { createRequest } from './requests.js';

const router = express.Router();

// Get all clients (view for all roles)
router.get('/', async (req, res) => {
  try {
    const clients = await query('SELECT * FROM clients');
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
  if (req.session.user.role !== 'accountant') return res.status(403).json({ error: 'Forbidden' });
  const { name, address, telephone, email, cgst, sgst } = req.body;
  try {
    const { id } = await run(
      'INSERT INTO clients (name, address, telephone, email, cgst, sgst) VALUES (?, ?, ?, ?, ?, ?)',
      [name, address, telephone, email, cgst, sgst]
    );
    res.json({ id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add category to client (accountant)
router.post('/:id/categories', async (req, res) => {
  if (req.session.user.role !== 'accountant') return res.status(403).json({ error: 'Forbidden' });
  const { category, monthly_rate } = req.body;
  try {
    await run(
      'INSERT INTO client_categories (client_id, category, monthly_rate) VALUES (?, ?, ?)',
      [req.params.id, category, monthly_rate]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export async function loadClients() {
  try {
    const response = await fetch('/api/clients');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const clients = await response.json();
    console.log('Loaded clients:', clients); // Debug log
    return clients;
  } catch (err) {
    console.error('Error loading clients:', err);
    return []; // Return empty array on error
  }
}

// console.log('Clients query result:', await query('SELECT * FROM clients'));

// Edit client (request approval if not admin)
router.put('/:id', async (req, res) => {
  const role = req.session.user.role;
  if (role === 'admin') return res.status(403).json({ error: 'Admin cannot edit directly' });
  if (role !== 'accountant') return res.status(403).json({ error: 'Forbidden' });
  try {
    await createRequest(req.session.user.id, 'edit', 'clients', req.params.id, JSON.stringify(req.body));
    res.json({ success: true, message: 'Edit request created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete client (request approval)
router.delete('/:id', async (req, res) => {
  const role = req.session.user.role;
  if (role === 'admin') return res.status(403).json({ error: 'Admin cannot delete directly' });
  if (role !== 'accountant') return res.status(403).json({ error: 'Forbidden' });
  try {
    await createRequest(req.session.user.id, 'delete', 'clients', req.params.id, null);
    res.json({ success: true, message: 'Delete request created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====== DIRECT EDIT SUPPORT FOR MODALS ======

// Get single client by ID (for edit modal pre-fill)
router.get('/:id/direct', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid ID' });
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
  if (req.session.user.role !== 'admin') return res.status(403).json({ error: 'Only admin can edit directly' });
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid ID' });

    const rows = await query('SELECT * FROM clients WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Client not found' });
    const current = rows[0];

    const {
      name = current.name,
      address = current.address,
      contact = current.contact,
      telephone = current.telephone,
      email = current.email,
      cgst = current.cgst,
      sgst = current.sgst
    } = req.body || {};

    await run(
      `UPDATE clients
         SET name = ?, address = ?, contact = ?, telephone = ?, email = ?,
             cgst = ?, sgst = ?
       WHERE id = ?`,
      [name, address, contact, telephone, email, cgst, sgst, id]
    );
    res.json({ ok: true, message: 'Client updated directly' });
  } catch (err) {
    console.error('PUT /clients/:id/direct error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==== GET one client by ID (for edit modal pre-fill) ====
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


export default router;