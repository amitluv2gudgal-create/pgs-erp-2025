// controllers/clients.js
// Full ready-to-drop controller for clients + categories
// Assumes db.query(sql, params) returns rows array and db.run(sql, params) runs statements.
// Written for your ES module project structure.

import { query, run } from '../db.js';

/**
 * Helper: load categories for a list of client ids
 * returns { <clientId>: [category, ...], ... }
 */
async function loadCategoriesMap(clientIds = []) {
  if (!clientIds || clientIds.length === 0) return {};
  // build placeholders
  const placeholders = clientIds.map(() => '?').join(',');
  const sql = `SELECT client_id, category, monthly_rate FROM client_categories WHERE client_id IN (${placeholders}) ORDER BY id ASC`;
  const rows = await query(sql, clientIds);
  const map = {};
  for (const r of rows) {
    (map[r.client_id] ||= []).push(r.category);
  }
  return map;
}

export async function listClients(req, res) {
  try {
    const qRaw = (req.query && req.query.q) ? String(req.query.q).trim() : '';
    const page = Math.max(1, parseInt(req.query?.page || '1', 10));
    const limit = Math.min(2000, Math.max(10, parseInt(req.query?.limit || '1000', 10)));
    const offset = (page - 1) * limit;

    let baseSql = `
      SELECT
        id,
        name,
        address_line1,
        address_line2,
        po_dated,
        state,
        district,
        contact_person,
        telephone,
        email,
        gst_number,
        cgst,
        sgst,
        igst
      FROM clients
    `;

    const params = [];
    if (qRaw) {
      baseSql += ` WHERE (LOWER(name) LIKE ? OR LOWER(gst_number) LIKE ? OR LOWER(address_line1) LIKE ? OR LOWER(address_line2) LIKE ? OR LOWER(contact_person) LIKE ?)`;
      const qLike = `%${qRaw.toLowerCase()}%`;
      params.push(qLike, qLike, qLike, qLike, qLike);
    }

    baseSql += ` ORDER BY id DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const clients = await query(baseSql, params);

    const clientIds = (Array.isArray(clients) && clients.length) ? clients.map(c => c.id) : [];
    let catsMap = {};
    if (clientIds.length) {
      const placeholders = clientIds.map(() => '?').join(',');
      const catRows = await query(`SELECT client_id, category FROM client_categories WHERE client_id IN (${placeholders}) ORDER BY id ASC`, clientIds);
      catsMap = {};
      for (const r of (catRows || [])) {
        (catsMap[r.client_id] ||= []).push(r.category);
      }
    }

    const normalized = (clients || []).map(c => ({
      id: c.id,
      name: c.name ?? '',
      address_line1: c.address_line1 ?? '',
      address_line2: c.address_line2 ?? '',
      po_dated: c.po_dated ?? '',
      state: c.state ?? '',
      district: c.district ?? '',
      contact_person: c.contact_person ?? '',
      telephone: c.telephone ?? '',
      email: c.email ?? '',
      gst_number: c.gst_number ?? '',
      cgst: c.cgst ?? 0,
      sgst: c.sgst ?? 0,
      igst: c.igst ?? 0,
      categories: catsMap[c.id] ?? []
    }));

    return res.json({ clients: normalized, page, limit });
  } catch (err) {
    console.error('[clients.list] Fatal error:', err && (err.stack || err));
    return res.status(500).json({ error: 'Failed to fetch clients' });
  }
}



//export async function listClients(req, res) {
  //try {
    // Basic server-side search + paging (non-strict/simple)
    //const qRaw = (req.query && req.query.q) ? String(req.query.q).trim() : '';
    //const page = Math.max(1, parseInt(req.query?.page || '1', 10));
    //const limit = Math.min(2000, Math.max(10, parseInt(req.query?.limit || '1000', 10)));
    //const offset = (page - 1) * limit;

    //let baseSql = `
    //SELECT
        //id,
        //name,
        //address_line1,
        //address_line2,
        //po_dated,
        //state,
        //district,
        //contact_person,
        //telephone,
        //email,
//         gst_number,
//         cgst,
//         sgst,
//         igst
//       FROM clients
//     `;

//     const params = [];
//     if (qRaw) {
//       // simple search across name, gst_number, address_line1/2, contact_person
//       baseSql += ` WHERE (LOWER(name) LIKE ? OR LOWER(gst_number) LIKE ? OR LOWER(address_line1) LIKE ? OR LOWER(address_line2) LIKE ? OR LOWER(contact_person) LIKE ?)`;
//       const qLike = `%${qRaw.toLowerCase()}%`;
//       params.push(qLike, qLike, qLike, qLike, qLike);
//     }

//     baseSql += ` ORDER BY id DESC LIMIT ? OFFSET ?`;
//     params.push(limit, offset);

//     const clients = await query(baseSql, params);

//     // load categories map
//     const clientIds = clients.map(c => c.id);
//     const catsMap = await loadCategoriesMap(clientIds);

//     // normalize
//     const normalized = clients.map(c => ({
//       id: c.id,
//       name: c.name ?? '',
//       address_line1: c.address_line1 ?? '',
//       address_line2: c.address_line2 ?? '',
//       po_dated: c.po_dated ?? '',
//       state: c.state ?? '',
//       district: c.district ?? '',
//       contact_person: c.contact_person ?? '',
//       telephone: c.telephone ?? '',
//       email: c.email ?? '',
//       gst_number: c.gst_number ?? '',
//       cgst: c.cgst ?? 0,
//       sgst: c.sgst ?? 0,
//       igst: c.igst ?? 0,
//       categories: catsMap[c.id] ?? []
//     }));

//     return res.json({ clients: normalized, page, limit });
//   } catch (err) {
//     console.error('[clients.list] error', err && err.message ? err.message : err);
//     return res.status(500).json({ error: 'Failed to fetch clients' });
//   }
// }

/**
 * GET /api/clients/:id
 */
export async function getClient(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid client id' });

    const rows = await query(
      `SELECT id, name, address_line1, address_line2, po_dated, state, district, contact_person, telephone, email, gst_number, cgst, sgst, igst
       FROM clients WHERE id = ? LIMIT 1`, [id]
    );

    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Client not found' });

    const client = rows[0];
    const cats = await query(`SELECT category FROM client_categories WHERE client_id = ? ORDER BY id ASC`, [id]);
    const categories = (cats || []).map(r => r.category);

    const normalized = {
      id: client.id,
      name: client.name ?? '',
      address_line1: client.address_line1 ?? '',
      address_line2: client.address_line2 ?? '',
      po_dated: client.po_dated ?? '',
      state: client.state ?? '',
      district: client.district ?? '',
      contact_person: client.contact_person ?? '',
      telephone: client.telephone ?? '',
      email: client.email ?? '',
      gst_number: client.gst_number ?? '',
      cgst: client.cgst ?? 0,
      sgst: client.sgst ?? 0,
      igst: client.igst ?? 0,
      categories
    };

    return res.json(normalized);
  } catch (err) {
    console.error('[clients.get] error', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'Failed to fetch client' });
  }
}

/**
 * POST /api/clients
 * Body expected: { name, address_line1, address_line2, po_dated, state, district, contact_person, telephone, email, gst_number, cgst, sgst, igst, categories: ["Cat A", ...] }
 */
export async function createClient(req, res) {
  try {
    const body = req.body || {};
    if (!body.name || String(body.name).trim() === '') return res.status(400).json({ error: 'Name required' });

    const insertSql = `
      INSERT INTO clients
        (name, address_line1, address_line2, po_dated, state, district, contact_person, telephone, email, gst_number, cgst, sgst, igst)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      body.name,
      body.address_line1 ?? '',
      body.address_line2 ?? '',
      body.po_dated ?? '',
      body.state ?? '',
      body.district ?? '',
      body.contact_person ?? '',
      body.telephone ?? '',
      body.email ?? '',
      body.gst_number ?? '',
      Number(body.cgst || 0),
      Number(body.sgst || 0),
      Number(body.igst || 0)
    ];

    const result = await run(insertSql, params);
    // sqlite 'run' usually returns { lastID } or similar depending on wrapper
    const newId = (result && result.lastID) ? result.lastID : null;

    // insert categories if provided
    if (Array.isArray(body.categories) && body.categories.length && newId) {
      const stmtSql = `INSERT INTO client_categories (client_id, category, monthly_rate) VALUES (?, ?, NULL)`;
      for (const cat of body.categories) {
        await run(stmtSql, [newId, String(cat)]);
      }
    }

    return res.status(201).json({ ok: true, id: newId });
  } catch (err) {
    console.error('[clients.create] error', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'Failed to create client' });
  }
}

/**
 * PUT /api/clients/:id
 * Body same as create (updates provided fields)
 */
export async function updateClient(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid client id' });

    const body = req.body || {};
    // Build update dynamically for provided fields (safer)
    const allowed = ['name','address_line1','address_line2','po_dated','state','district','contact_person','telephone','email','gst_number','cgst','sgst','igst'];
    const updates = [];
    const params = [];

    for (const k of allowed) {
      if (Object.prototype.hasOwnProperty.call(body, k)) {
        updates.push(`${k} = ?`);
        params.push(body[k] === null ? '' : body[k]);
      }
    }

    if (updates.length > 0) {
      const sql = `UPDATE clients SET ${updates.join(', ')} WHERE id = ?`;
      params.push(id);
      await run(sql, params);
    }

    // Replace categories if provided (atomic: delete old then insert new)
    if (Array.isArray(body.categories)) {
      await run(`DELETE FROM client_categories WHERE client_id = ?`, [id]);
      if (body.categories.length > 0) {
        const stmtSql = `INSERT INTO client_categories (client_id, category, monthly_rate) VALUES (?, ?, NULL)`;
        for (const cat of body.categories) {
          await run(stmtSql, [id, String(cat)]);
        }
      }
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('[clients.update] error', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'Failed to update client' });
  }
}

/**
 * DELETE /api/clients/:id
 * Soft-delete could be implemented; here we remove client and its categories.
 */
export async function deleteClient(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid client id' });

    // Remove categories first (foreign keys might require)
    await run(`DELETE FROM client_categories WHERE client_id = ?`, [id]);
    // Delete client
    await run(`DELETE FROM clients WHERE id = ?`, [id]);

    return res.json({ ok: true });
  } catch (err) {
    console.error('[clients.delete] error', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'Failed to delete client' });
  }
}

/**
 * POST /api/clients/:id/categories
 * Body: { category: "Category name", monthly_rate: 1234 }  -> adds a category
 */
export async function addClientCategory(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid client id' });
    const body = req.body || {};
    const cat = (body.category || '').trim();
    const monthly_rate = (body.monthly_rate != null) ? Number(body.monthly_rate) : null;
    if (!cat) return res.status(400).json({ error: 'category required' });

    const sql = `INSERT INTO client_categories (client_id, category, monthly_rate) VALUES (?, ?, ?)`;
    const params = [id, cat, monthly_rate];
    const r = await run(sql, params);
    const newId = (r && r.lastID) ? r.lastID : null;
    return res.status(201).json({ ok: true, id: newId });
  } catch (err) {
    console.error('[clients.addCategory] error', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'Failed to add category' });
  }
}

/**
 * DELETE /api/clients/:id/categories/:catId
 */
export async function removeClientCategory(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const catId = parseInt(req.params.catId, 10);
    if (!Number.isFinite(id) || !Number.isFinite(catId)) return res.status(400).json({ error: 'Invalid id' });

    await run(`DELETE FROM client_categories WHERE id = ? AND client_id = ?`, [catId, id]);
    return res.json({ ok: true });
  } catch (err) {
    console.error('[clients.removeCategory] error', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'Failed to remove category' });
  }
}

/**
 * Optional: GET /api/clients/:id/categories  -> returns categories array
 */
export async function listClientCategories(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid client id' });
    const rows = await query(`SELECT id, category, monthly_rate FROM client_categories WHERE client_id = ? ORDER BY id ASC`, [id]);
    return res.json({ categories: rows || [] });
  } catch (err) {
    console.error('[clients.listCategories] error', err && err.message ? err.message : err);
    return res.status(500).json({ error: 'Failed to load categories' });
  }
}

export default {
  listClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  addClientCategory,
  removeClientCategory,
  listClientCategories
};
