import express from 'express';
import { query, run } from '../db.js';
import { createRequest } from './requests.js';

const router = express.Router();

// Get all employees (view for all)
router.get('/', async (req, res) => {
  try {
    const employees = await query('SELECT * FROM employees');
    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create employee (hr only)
router.post('/', async (req, res) => {
  if (req.session.user.role !== 'hr') return res.status(403).json({ error: 'Forbidden' });
  const fields = [
    req.body.name, req.body.father_name, req.body.local_address, req.body.permanent_address,
    req.body.telephone, req.body.email, req.body.marital_status, req.body.spouse_name,
    req.body.next_kin_name, req.body.next_kin_telephone, req.body.next_kin_address,
    req.body.identifier_name, req.body.identifier_address, req.body.identifier_telephone,
    req.body.epf_number, req.body.esic_number, req.body.criminal_record, req.body.salary_per_month,
    req.body.category, req.body.client_id
  ];
  try {
    const { id } = await run(
      `INSERT INTO employees (name, father_name, local_address, permanent_address, telephone, email, marital_status, spouse_name,
      next_kin_name, next_kin_telephone, next_kin_address, identifier_name, identifier_address, identifier_telephone,
      epf_number, esic_number, criminal_record, salary_per_month, category, client_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      fields
    );
    res.json({ id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Edit employee (request approval)
router.put('/:id', async (req, res) => {
  const role = req.session.user.role;
  if (role === 'admin') return res.status(403).json({ error: 'Admin cannot edit directly' });
  if (role !== 'hr') return res.status(403).json({ error: 'Forbidden' });
  try {
    await createRequest(req.session.user.id, 'edit', 'employees', req.params.id, JSON.stringify(req.body));
    res.json({ success: true, message: 'Edit request created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete employee (request approval)
router.delete('/:id', async (req, res) => {
  const role = req.session.user.role;
  if (role === 'admin') return res.status(403).json({ error: 'Admin cannot delete directly' });
  if (role !== 'hr') return res.status(403).json({ error: 'Forbidden' });
  try {
    await createRequest(req.session.user.id, 'delete', 'employees', req.params.id, null);
    res.json({ success: true, message: 'Delete request created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;