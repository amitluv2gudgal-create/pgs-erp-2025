// controllers/clients.js
import * as db from '../db.js';

export async function getClients(req, res) {
  try {
    const clients = await db.getClients();
    return res.json(clients || []);
  } catch (err) {
    console.error('ERROR GET /api/clients ->', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: 'Server error fetching clients', message: err?.message });
  }
}

export async function createClient(req, res) {
  try {
    const payload = req.body || {};
    if (!payload.name) return res.status(400).json({ error: 'Client name required' });
    const inserted = await db.insertClient(payload);
    return res.status(201).json({ success: true, id: inserted?.id ?? null });
  } catch (err) {
    console.error('ERROR POST /api/clients ->', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: 'Server error creating client', message: err?.message });
  }
}
