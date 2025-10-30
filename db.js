// db.js
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';

// Prefer an absolute Disk path in production. Fallback keeps local dev working.
const DATA_DIR =
  process.env.DATA_DIR ||
  path.dirname(process.env.DB_PATH || '') ||
  '/var/data';

const DB_FILE = process.env.DB_PATH
  ? path.basename(process.env.DB_PATH)
  : 'database.db';

fs.mkdirSync(DATA_DIR, { recursive: true });
export const DB_PATH = path.join(DATA_DIR, DB_FILE);

// Keep a single connection for the process
let _dbPromise;
export async function getDB() {
  if (!_dbPromise) {
    _dbPromise = open({ filename: DB_PATH, driver: sqlite3.Database });
  }
  return _dbPromise;
}

export async function initDB() {
  const db = await getDB();

  await db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT
  )`);

  // NOTE: fresh installs get the new columns here;
  // existing installs will be upgraded by ensureClientExtraFields() below.
  await db.run(`CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    address TEXT,              -- legacy (unused by new UI)
    address_line1 TEXT,        -- NEW
    address_line2 TEXT,        -- NEW
    po_dated TEXT,             -- NEW
    state TEXT,
    district TEXT,
    contact TEXT,
    telephone TEXT,
    email TEXT,
    cgst REAL,
    sgst REAL
  )`);

  await db.run(`CREATE TABLE IF NOT EXISTS client_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER,
    category TEXT,
    monthly_rate REAL,
    FOREIGN KEY(client_id) REFERENCES clients(id)
  )`);

  await db.run(`CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    father_name TEXT,
    local_address TEXT,
    permanent_address TEXT,
    telephone TEXT,
    email TEXT,
    marital_status TEXT,
    spouse_name TEXT,
    next_kin_name TEXT,
    next_kin_telephone TEXT,
    next_kin_address TEXT,
    identifier_name TEXT,
    identifier_address TEXT,
    identifier_telephone TEXT,
    epf_number TEXT,
    esic_number TEXT,
    criminal_record TEXT,
    salary_per_month REAL,
    category TEXT,
    client_id INTEGER,
    FOREIGN KEY(client_id) REFERENCES clients(id)
  )`);

  await db.run(`CREATE TABLE IF NOT EXISTS attendances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER,
    date TEXT,
    present INTEGER,
    submitted_by INTEGER,
    client_id INTEGER,
    status TEXT DEFAULT 'pending',
    FOREIGN KEY(employee_id) REFERENCES employees(id),
    FOREIGN KEY(submitted_by) REFERENCES security_supervisors(id),
    FOREIGN KEY(client_id) REFERENCES clients(id)
  )`);

  await db.run(`CREATE TABLE IF NOT EXISTS deductions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER,
    amount REAL,
    reason TEXT,
    date TEXT,
    month TEXT,
    FOREIGN KEY(employee_id) REFERENCES employees(id)
  )`);

  await db.run(`CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER,
    month TEXT,
    invoice_no TEXT,
    subtotal REAL,
    service_charges REAL,
    total REAL,
    cgst_amount REAL,
    sgst_amount REAL,
    grand_total REAL,
    invoice_date TEXT,
    FOREIGN KEY(client_id) REFERENCES clients(id)
  )`);

  await db.run(`CREATE TABLE IF NOT EXISTS salaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER,
    month TEXT,
    attendance_days INTEGER,
    amount REAL,
    deductions REAL,
    net_amount REAL,
    salary_date TEXT,
    FOREIGN KEY(employee_id) REFERENCES employees(id)
  )`);

  await db.run(`CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requester_id INTEGER,
    action TEXT,
    table_name TEXT,
    record_id INTEGER,
    data TEXT,
    new_data TEXT,
    status TEXT DEFAULT 'pending',
    FOREIGN KEY(requester_id) REFERENCES users(id)
  )`);

  await db.run(`CREATE TABLE IF NOT EXISTS security_supervisors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    username TEXT UNIQUE,
    password TEXT,
    client_id INTEGER,
    site_name TEXT,
    created_by INTEGER,
    FOREIGN KEY(client_id) REFERENCES clients(id),
    FOREIGN KEY(created_by) REFERENCES users(id)
  )`);

  // --- Seed default users if missing ---
  await seedUser('admin', process.env.ADMIN_PASSWORD || 'Admin@123', 'admin');
  await seedUser('accountant', process.env.ACCOUNTANT_PASSWORD || 'Account@123', 'accountant');
  await seedUser('hr', process.env.HR_PASSWORD || 'Hr@123', 'hr');

  console.log('[db] SQLite file:', DB_PATH);
  return db;
}

async function seedUser(username, plain, role) {
  const db = await getDB();
  const existing = await db.get('SELECT id FROM users WHERE username = ?', username);
  if (!existing) {
    const hash = await bcrypt.hash(plain, 10);
    await db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', username, hash, role);
    console.log(`[seed] ${role} created → ${username}`);
  }
}

// --- Safe migration for existing databases ---
export async function ensureClientExtraFields() {
  const cols = await query(`PRAGMA table_info(clients)`);
  const names = new Set(cols.map(c => c.name));

  const toAdd = [];
  if (!names.has('address_line1')) toAdd.push(`ADD COLUMN address_line1 TEXT`);
  if (!names.has('address_line2')) toAdd.push(`ADD COLUMN address_line2 TEXT`);
  if (!names.has('po_dated'))     toAdd.push(`ADD COLUMN po_dated TEXT`);
  if (!names.has('state'))        toAdd.push(`ADD COLUMN state TEXT`);
  if (!names.has('district'))     toAdd.push(`ADD COLUMN district TEXT`);

  for (const clause of toAdd) {
    await run(`ALTER TABLE clients ${clause}`);
  }

  // Optional: backfill line1 from legacy single-line address
  if (!names.has('address_line1')) {
    await run(`
      UPDATE clients
      SET address_line1 = COALESCE(NULLIF(address_line1, ''), address)
      WHERE (address_line1 IS NULL OR address_line1 = '') AND address IS NOT NULL
    `);
  }
}

export async function query(sql, params = []) {
  const db = await getDB();
  return db.all(sql, params);
}

export async function run(sql, params = []) {
  const db = await getDB();
  const res = await db.run(sql, params);
  return { insertId: res?.lastID, changes: res?.changes };
}