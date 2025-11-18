// // controllers/employees.js
// import express from 'express';
// import { query, run } from '../db.js';
// import { createRequest } from './requests.js';
// import path from 'path';
// import fs from 'fs';
// import multer from 'multer';
// import { fileURLToPath } from 'url';

// const router = express.Router();

// // Setup upload dir and multer
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);
// const uploadsDir = path.join(__dirname, '..', 'uploads', 'employees');

// // ensure folder exists
// fs.mkdirSync(uploadsDir, { recursive: true });

// // storage with timestamped filename to avoid collisions
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => cb(null, uploadsDir),
//   filename: (req, file, cb) => {
//     const ext = path.extname(file.originalname) || '';
//     const base = path.basename(file.originalname, ext).replace(/\s+/g, '_').replace(/[^\w\-_.]/g, '');
//     const name = `${Date.now()}_${base}${ext}`;
//     cb(null, name);
//   }
// });

// const upload = multer({
//   storage,
//   limits: { fileSize: 6 * 1024 * 1024 }, // 6 MB limit
//   fileFilter: (req, file, cb) => {
//     // accept images only
//     if (!file.mimetype.startsWith('image/')) {
//       return cb(new Error('Only image files are allowed'));
//     }
//     cb(null, true);
//   }
// });

// // --------------------- routes ---------------------

// // Get all employees
// router.get('/', async (req, res) => {
//   try {
//     const employees = await query('SELECT * FROM employees ORDER BY id DESC');
//     res.json(employees);
//   } catch (err) {
//     console.error('GET /employees error:', err);
//     res.status(500).json({ error: err.message });
//   }
// });

// // Create employee (hr only) --- uses multer middleware to accept 'photo'
// router.post('/', upload.single('photo'), async (req, res) => {
//   try {
//     if (!req.session || req.session.user?.role !== 'hr') return res.status(403).json({ error: 'Forbidden' });

//     // req.body will contain string values from FormData
//     const body = req.body || {};

//     const fields = [
//       body.name, body.father_name, body.local_address, body.permanent_address,
//       body.telephone, body.email, body.marital_status, body.spouse_name,
//       body.next_kin_name, body.next_kin_telephone, body.next_kin_address,
//       body.identifier_name, body.identifier_address, body.identifier_telephone,
//       body.epf_number, body.esic_number, body.criminal_record, body.salary_per_month ? Number(body.salary_per_month) : null,
//       body.category, body.client_id ? Number(body.client_id) : null
//     ];

//     // If a file was uploaded, get its relative path to store in DB (relative to project root /uploads/...)
//     let photoPath = null;
//     if (req.file && req.file.filename) {
//       // store path like 'uploads/employees/filename.jpg'
//       photoPath = path.posix.join('uploads', 'employees', req.file.filename);
//     }

//     // Insert with photo (photo is last column)
//     // Ensure employees table has photo column (migration must be run)
//     const placeholders = fields.map(() => '?').join(', ');
//     // We'll append photo placeholder and include photo in values
//     const sql = `INSERT INTO employees 
//       (name, father_name, local_address, permanent_address, telephone, email, marital_status, spouse_name,
//        next_kin_name, next_kin_telephone, next_kin_address, identifier_name, identifier_address, identifier_telephone,
//        epf_number, esic_number, criminal_record, salary_per_month, category, client_id, photo)
//       VALUES (${placeholders}, ?)
//     `;
//     const params = [...fields, photoPath];

//     const { id } = await run(sql, params);
//     res.json({ id, photo: photoPath });
//   } catch (err) {
//     console.error('POST /employees error:', err);
//     // If multer error or file validation error, send meaningful error
//     if (err instanceof multer.MulterError) {
//       return res.status(400).json({ error: err.message });
//     }
//     res.status(500).send(err.message || 'Server error');
//   }
// });

// // Edit employee (request approval)
// router.put('/:id', async (req, res) => {
//   const role = req.session.user.role;
//   if (role === 'admin') return res.status(403).json({ error: 'Admin cannot edit directly' });
//   if (role !== 'hr') return res.status(403).json({ error: 'Forbidden' });
//   try {
//     await createRequest(req.session.user.id, 'edit', 'employees', req.params.id, JSON.stringify(req.body));
//     res.json({ success: true, message: 'Edit request created' });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// // Delete employee (request approval)
// router.delete('/:id', async (req, res) => {
//   const role = req.session.user.role;
//   if (role === 'admin') return res.status(403).json({ error: 'Admin cannot delete directly' });
//   if (role !== 'hr') return res.status(403).json({ error: 'Forbidden' });
//   try {
//     await createRequest(req.session.user.id, 'delete', 'employees', req.params.id, null);
//     res.json({ success: true, message: 'Delete request created' });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// // GET one employee by ID (for edit modal)
// router.get('/:id', async (req, res) => {
//   try {
//     const id = Number(req.params.id);
//     if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid ID' });

//     const rows = await query('SELECT * FROM employees WHERE id = ?', [id]);
//     if (!rows.length) return res.status(404).json({ error: 'Employee not found' });
//     res.json(rows[0]);
//   } catch (err) {
//     console.error('GET /employees/:id error:', err);
//     res.status(500).json({ error: 'Server error' });
//   }
// });

// // Update employee (admin/hr allowed)
// router.put('/:id/direct', async (req, res) => {
//   try {
//     const role = req.session?.user?.role;
//     if (!role) return res.status(401).json({ error: 'Unauthorized' });
//     if (!['admin', 'hr'].includes(role)) return res.status(403).json({ error: 'Forbidden' });

//     const id = Number(req.params.id);
//     if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid ID' });

//     const rows = await query('SELECT * FROM employees WHERE id = ?', [id]);
//     if (!rows.length) return res.status(404).json({ error: 'Employee not found' });
//     const cur = rows[0];

//     const {
//       name = cur.name,
//       father_name = cur.father_name,
//       local_address = cur.local_address,
//       permanent_address = cur.permanent_address,
//       telephone = cur.telephone,
//       email = cur.email,
//       marital_status = cur.marital_status,
//       spouse_name = cur.spouse_name,
//       next_kin_name = cur.next_kin_name,
//       next_kin_telephone = cur.next_kin_telephone,
//       next_kin_address = cur.next_kin_address,
//       identifier_name = cur.identifier_name,
//       identifier_address = cur.identifier_address,
//       identifier_telephone = cur.identifier_telephone,
//       epf_number = cur.epf_number,
//       esic_number = cur.esic_number,
//       criminal_record = cur.criminal_record,
//       salary_per_month = cur.salary_per_month,
//       category = cur.category,
//       client_id = cur.client_id
//     } = (req.body || {});

//     await run(
//       `UPDATE employees SET
//          name=?, father_name=?, local_address=?, permanent_address=?,
//          telephone=?, email=?, marital_status=?, spouse_name=?,
//          next_kin_name=?, next_kin_telephone=?, next_kin_address=?,
//          identifier_name=?, identifier_address=?, identifier_telephone=?,
//          epf_number=?, esic_number=?, criminal_record=?,
//          salary_per_month=?, category=?, client_id=?
//        WHERE id=?`,
//       [
//         name, father_name, local_address, permanent_address,
//         telephone, email, marital_status, spouse_name,
//         next_kin_name, next_kin_telephone, next_kin_address,
//         identifier_name, identifier_address, identifier_telephone,
//         epf_number, esic_number, criminal_record,
//         salary_per_month, category, client_id,
//         id
//       ]
//     );

//     res.json({ ok: true, message: 'Employee updated' });
//   } catch (err) {
//     console.error('PUT /employees/:id/direct error:', err);
//     res.status(500).json({ error: 'Server error' });
//   }
// });

// export default router;

// controllers/employees.js
import express from 'express';
import { getDB } from '../db.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'employees');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `emp-${unique}${ext}`);
  }
});

const upload = multer({ storage });

const nOrNull = v => (v === undefined || v === null || v === '') ? null : Number(v);
const boolInt = v => (v === '1' || v === 'true' || v === 'on' || v === 1) ? 1 : 0;

router.post('/', upload.single('photo'), async (req, res) => {
  try {
    const db = await getDB();
    const body = req.body || {};

    const params = [
      body.name || null,
      body.father_name || null,
      body.local_address || null,
      body.permanent_address || null,
      body.telephone || null,
      body.email || null,
      body.marital_status || null,
      body.spouse_name || null,
      body.next_kin_name || null,
      body.next_kin_telephone || null,
      body.next_kin_address || null,
      body.identifier_name || null,
      body.identifier_address || null,
      body.identifier_telephone || null,
      body.epf_number || null,
      body.esic_number || null,
      body.criminal_record || null,
      nOrNull(body.salary_per_month),
      nOrNull(body.basic_rate),
      nOrNull(body.special_allowance),
      nOrNull(body.hra),
      nOrNull(body.ca),
      nOrNull(body.wa),
      nOrNull(body.educational_allowance),
      nOrNull(body.add_4_hours),
      nOrNull(body.weekly_off_amount),
      nOrNull(body.salary_total_manual),
      boolInt(body.epf_on_basic),
      boolInt(body.epf_on_basic_plus_da),
      body.gender || null,
      body.category || null,
      nOrNull(body.client_id)
    ];

    let photoPath = null;
    if (req.file) photoPath = `/uploads/employees/${req.file.filename}`;

    const cols = [
      'name','father_name','local_address','permanent_address','telephone','email','marital_status','spouse_name',
      'next_kin_name','next_kin_telephone','next_kin_address','identifier_name','identifier_address','identifier_telephone',
      'epf_number','esic_number','criminal_record','salary_per_month',
      'basic_rate','special_allowance','hra','ca','wa','educational_allowance','add_4_hours','weekly_off_amount','salary_total_manual',
      'epf_on_basic','epf_on_basic_plus_da','gender','category','client_id','photo'
    ];

    const placeholders = cols.map(()=>'?').join(',');
    const finalParams = [...params, photoPath];

    const sql = `INSERT INTO employees (${cols.join(',')}) VALUES (${placeholders})`;
    const result = await db.run(sql, finalParams);

    res.json({ success: true, id: result.lastID });
  } catch (err) {
    console.error('create employee err', err);
    res.status(500).json({ success: false, error: String(err) });
  }
});

router.put('/:id', upload.single('photo'), async (req, res) => {
  try {
    const db = await getDB();
    const body = req.body || {};
    const id = Number(req.params.id);

    const fieldsToUpdate = {};
    const updatable = [
      'name','father_name','local_address','permanent_address','telephone','email','marital_status','spouse_name',
      'next_kin_name','next_kin_telephone','next_kin_address','identifier_name','identifier_address','identifier_telephone',
      'epf_number','esic_number','criminal_record','salary_per_month',
      'basic_rate','special_allowance','hra','ca','wa','educational_allowance','add_4_hours','weekly_off_amount','salary_total_manual',
      'epf_on_basic','epf_on_basic_plus_da','gender','category','client_id'
    ];

    for (const k of updatable) {
      if (typeof body[k] !== 'undefined') {
        if (k === 'epf_on_basic' || k === 'epf_on_basic_plus_da') {
          fieldsToUpdate[k] = boolInt(body[k]);
        } else if ([
          'basic_rate','special_allowance','hra','ca','wa','educational_allowance','add_4_hours','weekly_off_amount','salary_total_manual','salary_per_month','client_id'
        ].includes(k)) {
          fieldsToUpdate[k] = nOrNull(body[k]);
        } else {
          fieldsToUpdate[k] = body[k];
        }
      }
    }

    if (req.file) {
      fieldsToUpdate.photo = `/uploads/employees/${req.file.filename}`;
    }

    const setParts = Object.keys(fieldsToUpdate).map(k => `${k} = ?`);
    const params = Object.keys(fieldsToUpdate).map(k => fieldsToUpdate[k]);
    params.push(id);

    if (setParts.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    const sql = `UPDATE employees SET ${setParts.join(', ')} WHERE id = ?`;
    await db.run(sql, params);

    res.json({ success: true, id });
  } catch (err) {
    console.error('update employee err', err);
    res.status(500).json({ success: false, error: String(err) });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const db = await getDB();
    const id = Number(req.params.id);
    const emp = await db.get('SELECT * FROM employees WHERE id = ?', [id]);
    res.json({ success: true, employee: emp || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: String(err) });
  }
});

export default router;
