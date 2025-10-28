// controllers/security_supervisors.js
import express from 'express';
import { query, run } from '../db.js';
import { hash } from 'bcrypt';

const router = express.Router();

router.post('/create', async (req, res) => {
  if (!req.session?.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { name, username, password: providedPassword, client_id, site_name } = req.body;
  if (!name || !username || !client_id || !site_name) {
    return res.status(400).json({ error: 'Name, username, client ID, and site name are required' });
  }
  const password = providedPassword || 'defaultpassword';
  const hashedPassword = await hash(password, 10);
  const { id: creatorId } = req.session.user;
  try {
    const { lastID } = await run(
      'INSERT INTO security_supervisors (name, username, password, client_id, site_name, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [name, username, hashedPassword, client_id, site_name, creatorId]
    );
    console.log(`Supervisor created with ID: ${lastID}`);
    res.json({ id: lastID, name, username, client_id, site_name });
  } catch (err) {
    console.error('Insert error:', err.message);
    res.status(500).json({ error: 'Database error during creation' });
  }
});

router.put('/edit/:id', async (req, res) => {
  if (!req.session?.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { id } = req.params;
  const { name, site_name, client_id } = req.body;
  if (!name || !site_name || !client_id) {
    return res.status(400).json({ error: 'Name, site name, and client ID are required' });
  }
  try {
    await run('UPDATE security_supervisors SET name = ?, site_name = ?, client_id = ? WHERE id = ?', [name, site_name, client_id, id]);
    console.log(`Supervisor ${id} updated`);
    res.json({ message: 'Supervisor updated' });
  } catch (err) {
    console.error('Update error:', err.message);
    res.status(500).json({ error: 'Database error during update' });
  }
});

router.delete('/delete/:id', async (req, res) => {
  if (!req.session?.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { id } = req.params;
  try {
    await run('DELETE FROM security_supervisors WHERE id = ?', [id]);
    console.log(`Supervisor ${id} deleted`);
    res.json({ message: 'Supervisor deleted' });
  } catch (err) {
    console.error('Delete error:', err.message);
    res.status(500).json({ error: 'Database error during deletion' });
  }
});

router.get('/', async (req, res) => {
  if (!req.session?.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const supervisors = await query(`
      SELECT s.id, s.name, s.username, s.client_id, c.name AS client_name, s.site_name, s.password 
      FROM security_supervisors s
      LEFT JOIN clients c ON s.client_id = c.id
    `);
    console.log('Fetched supervisors:', supervisors);
    res.json(supervisors.map(sup => ({ ...sup, password: '******' })));
  } catch (err) {
    console.error('Query error:', err.message);
    res.status(500).json({ error: 'Database error during fetch' });
  }
});

export default router;