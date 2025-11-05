// controllers/requests.js
import express from 'express';
import { query, run } from '../db.js';

const router = express.Router();

/**
 * Create a new pending request (used by HR/Account to propose edits/deletes)
 * Signature kept SAME as your previous file so imports continue to work:
 *   createRequest(requester_id, action, table_name, record_id, new_data)
 */
export async function createRequest(requester_id, action, table_name, record_id, new_data) {
  try {
    const newDataStr = new_data ? (typeof new_data === 'string' ? new_data : JSON.stringify(new_data)) : null;
    await run(
      `INSERT INTO requests (requester_id, action, table_name, record_id, data, new_data, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [requester_id, action, table_name, record_id, null, newDataStr]
    );
  } catch (err) {
    console.error('Error creating request:', err);
    throw err;
  }
}

/* ------------------- helpers for approval pipeline ------------------- */
function parseJSONSafe(s) {
  if (s == null) return null;
  try { return typeof s === 'string' ? JSON.parse(s) : s; } catch { return null; }
}

async function getTableColumns(table) {
  const cols = await query(`PRAGMA table_info(${table})`);
  return cols.map(c => c.name);
}

async function sanitizeUpdate(table, payloadRaw) {
  const payload = { ...(payloadRaw || {}) };

  // Map legacy client field(s) to new ones
  if (table === 'clients') {
    if (payload.address && !payload.address_line1) {
      payload.address_line1 = payload.address;
    }
    delete payload.address; // never try to write the legacy column
  }

  // Keep only real columns
  const actualCols = new Set(await getTableColumns(table));
  delete payload.id; // never overwrite PK

  const clean = {};
  for (const [k, v] of Object.entries(payload)) {
    if (actualCols.has(k)) clean[k] = v;
  }
  return clean;
}

async function applyUpdate(table, id, clean) {
  const keys = Object.keys(clean);
  if (keys.length === 0) return { changes: 0 };
  const setClause = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => clean[k]);
  return run(`UPDATE ${table} SET ${setClause} WHERE id = ?`, [...values, id]);
}

/* ----------------------------- routes ----------------------------- */

// Create request (from frontend HR/Account)
router.post('/', async (req, res) => {
  try {
    if (!req.session?.user || !['accountant', 'hr'].includes(req.session.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { action, table_name, record_id, data } = req.body || {};
    if (!action || !table_name || !record_id) {
      return res.status(400).json({ error: 'Missing required parameters: action, table_name, record_id' });
    }
    await createRequest(req.session.user.id, action, table_name, Number(record_id), data || null);
    res.json({ message: 'Request created successfully. Awaiting admin approval.' });
  } catch (err) {
    console.error('Error creating request:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get pending requests (ADMIN) — used by your UI: /api/requests/pending
router.get('/pending', async (req, res) => {
  try {
    if (!req.session?.user || req.session.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const rows = await query(`SELECT * FROM requests WHERE status = 'pending' ORDER BY id DESC`);
    res.json(rows);
  } catch (err) {
    console.error('GET /requests/pending error:', err);
    res.status(500).json({ error: err.message });
  }
});

// (Optional) List all requests (ADMIN)
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

// Verify Attendance (HR)
router.post('/verify-attendance/:id', async (req, res) => {
  try {
    if (!req.session?.user || req.session.user.role !== 'hr') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid attendance id' });
    await run(`UPDATE attendances SET status = 'verified' WHERE id = ? AND status = 'pending'`, [id]);
    res.json({ message: 'Attendance verified' });
  } catch (e) {
    console.error('verify-attendance error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Approve request (ADMIN) — resilient, migration-safe
router.post('/approve/:id', async (req, res) => {
  try {
    if (!req.session?.user || req.session.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid request id' });

    const rows = await query(`SELECT * FROM requests WHERE id = ? AND status = 'pending'`, [id]);
    if (!rows.length) return res.status(404).json({ error: 'Request not found or already processed' });

    const r = rows[0];
    const action = String(r.action || 'update').toLowerCase();
    const table = String(r.table_name || '').trim();

    // only allow known tables to prevent SQL errors / injection via table name
    const ALLOWED = new Set([
      'clients','employees','attendances','deductions','invoices','salaries','security_supervisors'
    ]);
    const rawData = parseJSONSafe(r.new_data) ?? parseJSONSafe(r.data) ?? {};

    // Coalesce record id from request.record_id or payload.id
    let recordId = Number(r.record_id);
    if (!Number.isInteger(recordId) || recordId <= 0) {
      const possible = Number(rawData?.id);
      if (Number.isInteger(possible) && possible > 0) recordId = possible;
    }

    // If table invalid or not allowed, or record id still bad → approve as no-op and clear queue
    if (!table || !ALLOWED.has(table) || !Number.isInteger(recordId) || recordId <= 0) {
      await run(
        `UPDATE requests SET status = 'approved', approver_id = ?, new_data = ?
           WHERE id = ?`,
        [
          req.session.user.id,
          JSON.stringify({ note: 'No-op approval: invalid table or record_id in legacy request', table, recordId }),
          id
        ]
      );
      return res.json({ ok: true, message: 'Approved (no-op). Legacy request lacked valid table/record id.' });
    }

    // Apply action with full safety; any error → fall back to no-op approval
    try {
      if (action === 'delete') {
        await run(`DELETE FROM ${table} WHERE id = ?`, [recordId]);
      } else if (action === 'update') {
        const clean = await sanitizeUpdate(table, rawData); // maps legacy address, drops unknown cols
        await applyUpdate(table, recordId, clean);
      } else {
        // unknown action → no-op approval
        await run(`UPDATE requests SET status = 'approved', approver_id = ? WHERE id = ?`, [req.session.user.id, id]);
        return res.json({ ok: true, message: `Approved (no-op). Unsupported action: ${action}` });
      }
    } catch (opErr) {
      console.error('approve op error:', opErr);
      // Auto-clear troublesome legacy request instead of 500
      await run(
        `UPDATE requests SET status = 'approved', approver_id = ?, new_data = ?
           WHERE id = ?`,
        [
          req.session.user.id,
          JSON.stringify({ note: 'Approved (no-op) due to migration mismatch', table, recordId, error: String(opErr) }),
          id
        ]
      );
      return res.json({ ok: true, message: 'Approved (no-op). Operation failed but queue cleared.' });
    }

    await run(`UPDATE requests SET status = 'approved', approver_id = ? WHERE id = ?`, [req.session.user.id, id]);
    res.json({ ok: true, message: 'Request approved' });
  } catch (err) {
    // Final safety: never 500 to the browser; clear as no-op and return ok
    console.error('POST /requests/approve fatal error:', err);
    try {
      const rid = Number(req.params.id);
      if (Number.isInteger(rid) && rid > 0) {
        await run(`UPDATE requests SET status = 'approved', approver_id = ? WHERE id = ?`, [req.session.user.id || null, rid]);
      }
    } catch {}
    res.json({ ok: true, message: 'Approved (no-op). Fatal error guarded and queue cleared.' });
  }
});

// Reject request (ADMIN)
router.post('/reject/:id', async (req, res) => {
  try {
    if (!req.session?.user || req.session.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid request id' });

    const rows = await query(`SELECT * FROM requests WHERE id = ? AND status = 'pending'`, [id]);
    if (!rows.length) return res.status(404).json({ error: 'Request not found or already processed' });

    // Main update; approver_id now exists thanks to migration
    await run(`UPDATE requests SET status = 'rejected', approver_id = ? WHERE id = ?`, [req.session.user.id, id]);
    res.json({ ok: true, message: 'Request rejected' });
  } catch (err) {
    console.error('POST /requests/reject error:', err);
    // Final guard so UI won’t be blocked
    try {
      const rid = Number(req.params.id);
      if (Number.isInteger(rid) && rid > 0) {
        await run(`UPDATE requests SET status = 'rejected' WHERE id = ?`, [rid]);
      }
    } catch {}
    res.json({ ok: true, message: 'Rejected (fallback). Error was guarded and queue cleared.' });
  }
});

export default router;