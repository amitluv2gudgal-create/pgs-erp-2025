// PGS-ERP/controllers/requests.js
import express from 'express';
import { query, run } from '../db.js';

const router = express.Router();

// Create request (internal function)
export async function createRequest(requester_id, action, table_name, record_id, new_data) {
  try {
    await run(
      'INSERT INTO requests (requester_id, action, table_name, record_id, data, new_data, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [requester_id, action, table_name, record_id, null, new_data || null, 'pending']
    );
  } catch (err) {
    console.error('Error creating request:', err);
    throw err;
  }
}

// POST route to create a new request (for edit/delete from frontend)
router.post('/', async (req, res) => {
  if (!['accountant', 'hr'].includes(req.session.user.role)) return res.status(403).json({ error: 'Forbidden' });
  const { action, table_name, record_id, data } = req.body;
  try {
    if (!action || !table_name || !record_id) {
      throw new Error('Missing required parameters: action, table_name, record_id');
    }
    await createRequest(req.session.user.id, action, table_name, record_id, data);
    res.json({ message: 'Request created successfully. Awaiting admin approval.' });
  } catch (err) {
    console.error('Error creating request:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get pending requests (admin only)
router.get('/pending', async (req, res) => {
  if (req.session.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    const requests = await query('SELECT * FROM requests WHERE status = "pending"');
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verify Attendance
router.post('/verify-attendance/:id', async (req, res) => {
  if (!req.session?.user || req.session.user.role !== 'hr') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { id } = req.params;
  await run('UPDATE attendances SET status = ? WHERE id = ? AND status = ?', ['verified', id, 'pending']);
  res.json({ message: 'Attendance verified' });
});

// Approve request (admin)
router.post('/approve/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const request = await query('SELECT * FROM requests WHERE id = ? AND status = ?', [id, 'pending']);
    if (!request.length) return res.status(404).json({ error: 'Request not found or already processed' });

    const { table_name, record_id, new_data } = request[0];
    if (new_data) {
      // Handle edit request
      const updateData = JSON.parse(new_data);
      const setClauses = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
      const values = [...Object.values(updateData), record_id];
      await run(`UPDATE ${table_name} SET ${setClauses} WHERE id = ?`, values);
    } else if (request[0].action === 'delete') {
      // Handle delete request
      await run(`DELETE FROM ${table_name} WHERE id = ?`, [record_id]);
    }
    await run('UPDATE requests SET status = ? WHERE id = ?', ['approved', id]);
    res.json({ success: true, message: 'Request approved' });
  } catch (err) {
    console.error('Error approving request:', err);
    res.status(500).json({ error: err.message });
  }
});

// Reject request (admin)
router.post('/reject/:id', async (req, res) => {
  if (req.session.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  try {
    await run('UPDATE requests SET status = ?, approver_id = ? WHERE id = ?', ['rejected', req.session.user.id, req.params.id]);
    res.json({ success: true, message: 'Request rejected' });
  } catch (err) {
    console.error('Error rejecting request:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;