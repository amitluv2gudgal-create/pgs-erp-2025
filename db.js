// db.js
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';

// Prefer an absolute Disk path in production. Fallback keeps local dev working.
const DATA_DIR =
  process.env.DATA_DIR ||
  path.dirname(process.env.DB_PATH || '') ||            // if DB_PATH=/var/data/database.db
  '/var/data';                                          // Render's common Disk mount

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

  await db.run(`CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    address TEXT,
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

  // --- Seed admin if missing ---
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const existing = await db.get('SELECT id FROM users WHERE username = ?', adminUsername);
  if (!existing) {
    const plain = process.env.ADMIN_PASSWORD || 'Admin@123';
    const hash = await bcrypt.hash(plain, 10);
    await db.run(
      'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      adminUsername, hash, 'admin'
    );
    console.log(`[seed] Admin created → ${adminUsername}`);
  }

  console.log('[db] SQLite file:', DB_PATH);
  return db;
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
