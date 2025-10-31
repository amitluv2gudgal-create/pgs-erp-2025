import express from 'express';
import { query, run } from '../db.js';
import { createRequest } from './requests.js';

const router = express.Router();

router.get('/', async (req, res) => {
  console.log('[employees] GET /api/employees - session:', !!req.session?.user, req.session?.user?.username);
  try {
    const employees = await query('SELECT * FROM employees');
    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


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

// ==== GET one employee by ID (for edit modal) ====
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid ID' });

    const rows = await query('SELECT * FROM employees WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Employee not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /employees/:id error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==== UPDATE one employee (PUT) ====
// Allowed: admin, hr. (Accountant & supervisor cannot directly edit employees)
router.put('/:id', async (req, res) => {
  try {
    const role = req.session?.user?.role;
    if (!role) return res.status(401).json({ error: 'Unauthorized' });
    if (!['admin', 'hr'].includes(role)) return res.status(403).json({ error: 'Forbidden' });

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid ID' });

    const rows = await query('SELECT * FROM employees WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Employee not found' });
    const cur = rows[0];

    const {
      name = cur.name,
      father_name = cur.father_name,
      local_address = cur.local_address,
      permanent_address = cur.permanent_address,
      telephone = cur.telephone,
      email = cur.email,
      marital_status = cur.marital_status,
      spouse_name = cur.spouse_name,
      next_kin_name = cur.next_kin_name,
      next_kin_telephone = cur.next_kin_telephone,
      next_kin_address = cur.next_kin_address,
      identifier_name = cur.identifier_name,
      identifier_address = cur.identifier_address,
      identifier_telephone = cur.identifier_telephone,
      epf_number = cur.epf_number,
      esic_number = cur.esic_number,
      criminal_record = cur.criminal_record,
      salary_per_month = cur.salary_per_month,
      category = cur.category,
      client_id = cur.client_id
    } = (req.body || {});

    await run(
      `UPDATE employees
          SET name=?, father_name=?, local_address=?, permanent_address=?,
              telephone=?, email=?, marital_status=?, spouse_name=?,
              next_kin_name=?, next_kin_telephone=?, next_kin_address=?,
              identifier_name=?, identifier_address=?, identifier_telephone=?,
              epf_number=?, esic_number=?, criminal_record=?,
              salary_per_month=?, category=?, client_id=?
        WHERE id=?`,
      [
        name, father_name, local_address, permanent_address,
        telephone, email, marital_status, spouse_name,
        next_kin_name, next_kin_telephone, next_kin_address,
        identifier_name, identifier_address, identifier_telephone,
        epf_number, esic_number, criminal_record,
        salary_per_month, category, client_id,
        id
      ]
    );

    res.json({ ok: true, message: 'Employee updated' });
  } catch (err) {
    console.error('PUT /employees/:id error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;