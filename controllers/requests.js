// controllers/requests.js
import express from 'express';
import { query, run } from '../db.js';

const router = express.Router();

// Helpers ----------------------------------------------------

/** Get list of column names for a table from SQLite */
async function getTableColumns(table) {
  const cols = await query(`PRAGMA table_info(${table})`);
  return cols.map(c => c.name);
}

/** Parse JSON safely */
function parseJSONSafe(s) {
  if (s == null) return null;
  try { return typeof s === 'string' ? JSON.parse(s) : s; } catch { return null; }
}

/** Prepare sanitized update payload: intersect keys with actual columns, apply legacy mappings */
async function sanitizeUpdate(table, payloadRaw) {
  const payload = { ...(payloadRaw || {}) };

  // Legacy → new column mapping for clients
  if (table === 'clients') {
    if (payload.address && !payload.address_line1) {
      payload.address_line1 = payload.address;
    }
    delete payload.address; // ensure we never try to write legacy column
  }

  const cols = await getTableColumns(table);
  const allowed = new Set(cols);

  // Never allow id overwrite
  delete payload.id;

  // Keep only known columns
  const clean = {};
  for (const [k, v] of Object.entries(payload)) {
    if (allowed.has(k)) clean[k] = v;
  }
  return clean;
}

/** Apply an UPDATE */
async function applyUpdate(table, id, clean) {
  const keys = Object.keys(clean);
  if (!keys.length) {
    // nothing to update; treat as success
    return { changes: 0 };
  }
  const setClause = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => clean[k]);
  return await run(`UPDATE ${table} SET ${setClause} WHERE id = ?`, [...values, id]);
}

/** Apply a DELETE */
async function applyDelete(table, id) {
  return await run(`DELETE FROM ${table} WHERE id = ?`, [id]);
}

/** Load one request row by id */
async function getRequestById(id) {
  const rows = await query(`SELECT * FROM requests WHERE id = ?`, [id]);
  return rows[0] || null;
}

// Routes -----------------------------------------------------

// List pending requests
router.get('/', async (req, res) => {
  try {
    if (!req.session?.user || req.session.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const rows = await query(`SELECT * FROM requests ORDER BY id DESC`);
    res.json(rows);
  } catch (e) {
    console.error('GET /requests error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Approve a request (update/delete)
router.post('/approve/:id', async (req, res) => {
  try {
    if (!req.session?.user || req.session.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid request id' });

    const r = await getRequestById(id);
    if (!r) return res.status(404).json({ error: 'Request not found' });
    if (r.status && r.status !== 'pending') {
      return res.status(400).json({ error: `Request already ${r.status}` });
    }

    const action = String(r.action || 'update').toLowerCase();
    const table = String(r.table_name || '').trim();
    const recordId = Number(r.record_id);

    if (!table) return res.status(400).json({ error: 'Missing table_name in request' });
    if (!Number.isInteger(recordId) || recordId <= 0) {
      return res.status(400).json({ error: 'Invalid record_id in request' });
    }

    // Data to apply (prefer new_data; fallback to data)
    const newData = parseJSONSafe(r.new_data) ?? parseJSONSafe(r.data) ?? {};

    if (action === 'delete') {
      await applyDelete(table, recordId);
    } else if (action === 'update') {
      const clean = await sanitizeUpdate(table, newData);
      // If nothing to apply, still mark approved to clear the queue
      await applyUpdate(table, recordId, clean);
    } else {
      return res.status(400).json({ error: `Unsupported action: ${action}` });
    }

    await run(`UPDATE requests SET status = 'approved' WHERE id = ?`, [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('POST /requests/approve error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reject a request
router.post('/reject/:id', async (req, res) => {
  try {
    if (!req.session?.user || req.session.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid request id' });
    const r = await getRequestById(id);
    if (!r) return res.status(404).json({ error: 'Request not found' });
    if (r.status && r.status !== 'pending') {
      return res.status(400).json({ error: `Request already ${r.status}` });
    }
    await run(`UPDATE requests SET status = 'rejected' WHERE id = ?`, [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('POST /requests/reject error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
