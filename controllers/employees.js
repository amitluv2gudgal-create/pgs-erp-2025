// controllers/employees.js
import express from 'express';
import { query, run } from '../db.js';
import { createRequest } from './requests.js';

const router = express.Router();

/**
 * GET /api/employees
 * - Auth required.
 * - admin/accountant/hr => returns all employees
 * - security_supervisor => returns employees belonging to supervisor's client (if supervisor has client_id)
 * - others => empty list (or change as required)
 */
router.get('/', async (req, res) => {
  try {
    if (!req.session?.user) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }

    const role = req.session.user.role || '';
    if (['admin', 'accountant', 'hr'].includes(role)) {
      const rows = await query(
        `SELECT id, name, category, client_id, telephone, email
         FROM employees
         ORDER BY id DESC`
      );
      return res.json(rows);
    }

    // If supervisor, optionally return employees for their client
    if (role === 'security_supervisor') {
      // If your supervisor user has client_id in session, use that; otherwise return empty
      const clientId = req.session.user.client_id ?? null;
      if (!clientId) return res.json([]);
      const rows = await query(
        `SELECT id, name, category, client_id, telephone, email
         FROM employees WHERE client_id = ? ORDER BY id DESC`,
        [clientId]
      );
      return res.json(rows);
    }

    // Default: return empty array (safer than leaking data)
    return res.json([]);
  } catch (err) {
    console.error('GET /api/employees error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /api/employees
 * - Create employee (hr only)
 */
router.post('/', async (req, res) => {
  try {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthenticated' });
    if (req.session.user.role !== 'hr') return res.status(403).json({ error: 'Forbidden' });

    const fields = [
      req.body.name, req.body.father_name, req.body.local_address, req.body.permanent_address,
      req.body.telephone, req.body.email, req.body.marital_status, req.body.spouse_name,
      req.body.next_kin_name, req.body.next_kin_telephone, req.body.next_kin_address,
      req.body.identifier_name, req.body.identifier_address, req.body.identifier_telephone,
      req.body.epf_number, req.body.esic_number, req.body.criminal_record, req.body.salary_per_month,
      req.body.category, req.body.client_id
    ];

    const resRun = await run(
      `INSERT INTO employees (name, father_name, local_address, permanent_address, telephone, email, marital_status, spouse_name,
      next_kin_name, next_kin_telephone, next_kin_address, identifier_name, identifier_address, identifier_telephone,
      epf_number, esic_number, criminal_record, salary_per_month, category, client_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      fields
    );
    res.json({ id: resRun.insertId ?? null });
  } catch (err) {
    console.error('POST /api/employees error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/employees/:id
 * - Fetch one employee record
 */
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid ID' });

    const rows = await query('SELECT * FROM employees WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Employee not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('GET /api/employees/:id error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * PUT /api/employees/:id
 * - admin => allowed to update directly
 * - hr => creates an edit request which admin will approve
 * - others => forbidden
 *
 * NOTE: This unifies previous duplicate handlers into a single predictable behavior.
 */
router.put('/:id', async (req, res) => {
  try {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthenticated' });
    const role = req.session.user.role || '';
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid ID' });

    // Ensure the employee exists
    const existing = await query('SELECT * FROM employees WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ error: 'Employee not found' });

    if (role === 'admin') {
      // Direct update by admin
      const cur = existing[0];
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

      return res.json({ ok: true, message: 'Employee updated' });
    }

    if (role === 'hr') {
      // HR cannot update directly; create a request for admin approval
      try {
        // createRequest(requester_id, action, table_name, record_id, new_data)
        await createRequest(req.session.user.id, 'update', 'employees', id, req.body);
        return res.json({ success: true, message: 'Edit request created' });
      } catch (err) {
        console.error('createRequest error:', err);
        return res.status(500).json({ error: 'Failed to create edit request' });
      }
    }

    // other roles not allowed
    return res.status(403).json({ error: 'Forbidden' });
  } catch (err) {
    console.error('PUT /api/employees/:id error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * DELETE /api/employees/:id
 * - HR creates delete request; admin may delete directly if you prefer (currently HR creates request)
 */
router.delete('/:id', async (req, res) => {
  try {
    if (!req.session?.user) return res.status(401).json({ error: 'Unauthenticated' });
    const role = req.session.user.role || '';
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid ID' });

    if (role === 'admin') {
      await run('DELETE FROM employees WHERE id = ?', [id]);
      return res.json({ ok: true, message: 'Employee deleted' });
    }

    if (role === 'hr') {
      await createRequest(req.session.user.id, 'delete', 'employees', id, null);
      return res.json({ success: true, message: 'Delete request created' });
    }

    return res.status(403).json({ error: 'Forbidden' });
  } catch (err) {
    console.error('DELETE /api/employees/:id error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
