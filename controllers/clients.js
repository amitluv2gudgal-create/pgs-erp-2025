// controllers/clients.js
// ES module router for clients: List, Get, Create (reliable lastID fallback), Update, Delete
import express from 'express';
import { run, query } from '../db.js'; // adjust path if your db helpers are elsewhere

const router = express.Router();

// Utility to safely parse numbers
const toNumber = (v, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

// GET /api/clients  -> list all clients
router.get('/', async (req, res) => {
  try {
    // Select explicit columns and alias address_line1 as address for backward compat.
    const rows = await query(`
      SELECT
        id, name,
        address_line1,
        address_line1 AS address,
        address_line2,
        contact, telephone, email,
        cgst, sgst, gst_number, igst,
        po_dated, state, district, monthly_rate
      FROM clients
      ORDER BY id DESC
    `);
    res.json(rows || []);
  } catch (err) {
    console.error('[clients.GET] error:', err);
    res.status(500).json({ error: 'Failed to load clients' });
  }
});

// GET /api/clients/:id  -> get single client
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const rows = await query(`
      SELECT
        id, name,
        address_line1,
        address_line1 AS address,
        address_line2,
        contact, telephone, email,
        cgst, sgst, gst_number, igst,
        po_dated, state, district, monthly_rate
      FROM clients WHERE id = ?
    `, [id]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[clients.GET:id] error:', err);
    res.status(500).json({ error: 'Failed to load client' });
  }
});

// POST /api/clients -> create client (returns full created row)
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    // read new field names (address_line1 etc.)
    const name = (body.name || '').trim();
    const address_line1 = (body.address_line1 || '').trim();
    const address_line2 = (body.address_line2 || '').trim();
    const contact = (body.contact || '').trim();
    const telephone = (body.telephone || '').trim();
    const email = (body.email || '').trim();
    const cgst = toNumber(body.cgst, 0);
    const sgst = toNumber(body.sgst, 0);
    const gst_number = (body.gst_number || '').trim();
    const igst = toNumber(body.igst, 0);
    const po_dated = (body.po_dated || '').trim();
    const state = (body.state || '').trim();
    const district = (body.district || '').trim();
    const monthly_rate = toNumber(body.monthly_rate, 0);

    console.log('[clients.POST] creating client by user:', req.session?.user?.username, req.session?.user?.role);
    const sql = `
      INSERT INTO clients
        (name, address_line1, address_line2, contact, telephone, email, cgst, sgst, gst_number, igst, po_dated, state, district, monthly_rate)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `;
    const params = [name, address_line1, address_line2, contact, telephone, email, cgst, sgst, gst_number, igst, po_dated, state, district, monthly_rate];

    const insertResult = await run(sql, params);
    console.log('[clients.POST] raw insertResult:', insertResult);

    // Robust fallback to obtain last inserted id
    let insertId = insertResult?.lastID ?? insertResult?.insertId ?? insertResult?.id ?? null;
    try {
      if (!insertId) {
        const ridRows = await query('SELECT last_insert_rowid() as id');
        if (Array.isArray(ridRows) && ridRows.length) insertId = ridRows[0].id;
        console.log('[clients.POST] last_insert_rowid fallback returned:', insertId);
      }
    } catch (e) {
      console.warn('[clients.POST] last_insert_rowid query failed:', e && e.message ? e.message : e);
    }

    if (!insertId) {
      // final fallback: find by unique combo (name + telephone + email)
      const fallbackRows = await query(
        `SELECT * FROM clients WHERE name = ? AND (telephone = ? OR email = ?) ORDER BY id DESC LIMIT 1`,
        [name, telephone || '', email || '']
      );
      if (fallbackRows && fallbackRows.length) {
        console.log('[clients.POST] returning fallback row by unique fields id=', fallbackRows[0].id);
        return res.status(201).json(fallbackRows[0]);
      }
      // still nothing — respond with generic success (rare)
      console.warn('[clients.POST] Could not resolve insertId; returning generic ok');
      return res.status(201).json({ ok: true });
    }

    // retrieve the created row and return it
    const createdRows = await query('SELECT id, name, address_line1, address_line1 AS address, address_line2, contact, telephone, email, cgst, sgst, gst_number, igst, po_dated, state, district, monthly_rate FROM clients WHERE id = ?', [insertId]);
    if (!createdRows || createdRows.length === 0) return res.status(201).json({ ok: true });
    console.log('[clients.POST] created client row returned id=', insertId);
    return res.status(201).json(createdRows[0]);
  } catch (err) {
    console.error('[clients.POST] error:', err);
    res.status(500).json({ error: 'Failed to create client' });
  }
});

// PUT /api/clients/:id -> update client
router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = req.body || {};
    const name = (body.name || '').trim();
    const address_line1 = (body.address_line1 || '').trim();
    const address_line2 = (body.address_line2 || '').trim();
    const contact = (body.contact || '').trim();
    const telephone = (body.telephone || '').trim();
    const email = (body.email || '').trim();
    const cgst = toNumber(body.cgst, 0);
    const sgst = toNumber(body.sgst, 0);
    const gst_number = (body.gst_number || '').trim();
    const igst = toNumber(body.igst, 0);
    const po_dated = (body.po_dated || '').trim();
    const state = (body.state || '').trim();
    const district = (body.district || '').trim();
    const monthly_rate = toNumber(body.monthly_rate, 0);

    const sql = `
      UPDATE clients SET
        name = ?, address_line1 = ?, address_line2 = ?, contact = ?,
        telephone = ?, email = ?, cgst = ?, sgst = ?, gst_number = ?, igst = ?,
        po_dated = ?, state = ?, district = ?, monthly_rate = ?
      WHERE id = ?
    `;
    await run(sql, [name, address_line1, address_line2, contact, telephone, email, cgst, sgst, gst_number, igst, po_dated, state, district, monthly_rate, id]);
    const rows = await query('SELECT id, name, address_line1, address_line1 AS address, address_line2, contact, telephone, email, cgst, sgst, gst_number, igst, po_dated, state, district, monthly_rate FROM clients WHERE id = ?', [id]);
    res.json(rows[0] || { ok: true });
  } catch (err) {
    console.error('[clients.PUT] error:', err);
    res.status(500).json({ error: 'Failed to update client' });
  }
});

// DELETE /api/clients/:id -> remove client
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    await run('DELETE FROM clients WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[clients.DELETE] error:', err);
    res.status(500).json({ error: 'Failed to delete client' });
  }
});

export default router;
