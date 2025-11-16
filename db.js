// db.js
// SQLite initialization and helpers (ESM). No duplicate exports.

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';

// Resolve DB path priority
const ENV_DB_FILE = process.env.DATABASE_FILE || process.env.DB_PATH || process.env.DB_FILE;
const ENV_DATA_DIR = process.env.DATA_DIR;

let DATA_DIRECTORY;
let DB_FILE_PATH;

if (ENV_DB_FILE) {
  DB_FILE_PATH = path.resolve(ENV_DB_FILE);
  DATA_DIRECTORY = path.dirname(DB_FILE_PATH);
} else if (ENV_DATA_DIR) {
  DATA_DIRECTORY = path.resolve(ENV_DATA_DIR);
  DB_FILE_PATH = path.join(DATA_DIRECTORY, 'database.db');
} else {
  DATA_DIRECTORY = path.resolve(process.cwd());
  DB_FILE_PATH = path.join(DATA_DIRECTORY, 'database.db');
}

// Ensure data directory exists (avoid SQLITE_CANTOPEN when dir missing)
try {
  fs.mkdirSync(DATA_DIRECTORY, { recursive: true });
} catch (err) {
  console.error('[db.js] Failed to create data directory:', DATA_DIRECTORY, err);
  // continue — open will fail later if truly not writable
}

// Export names (no redeclaration)
export { DB_FILE_PATH, DATA_DIRECTORY };

// --- DB singleton & helpers ---
let _dbPromise = null;
export async function getDB() {
  if (!_dbPromise) {
    _dbPromise = open({
      filename: DB_FILE_PATH,
      driver: sqlite3.Database,
      mode: sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE
    });
  }
  return _dbPromise;
}

export async function initDB() {
  const db = await getDB();

  await db.exec('BEGIN TRANSACTION');
  try {
    // create tables (idempotent)
    await db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT
    )`);

    await db.run(`CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      address_line1 TEXT,
      address_line2 TEXT,
      state TEXT,
      district TEXT,
      telephone TEXT,
      email TEXT
    )`);

    await db.run(`CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      telephone TEXT,
      email TEXT,
      salary_per_month REAL,
      category TEXT,
      client_id INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE SET NULL
    )`);

    await db.run(`CREATE TABLE IF NOT EXISTS attendances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER,
      date TEXT,
      present INTEGER DEFAULT 0,
      submitted_by INTEGER,
      client_id INTEGER,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )`);

    await db.run(`CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER,
      month TEXT,
      invoice_no TEXT,
      subtotal REAL,
      total REAL,
      invoice_date TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )`);

    await db.exec('COMMIT');
  } catch (err) {
    try { await db.exec('ROLLBACK'); } catch (_) {}
    console.error('[db:init] Schema creation failed:', err);
    throw err;
  }

  // seed default users (safe)
  try {
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'Admin@123';
    const accountantUsername = process.env.ACCOUNTANT_USERNAME || 'accountant';
    const accountantPass = process.env.ACCOUNTANT_PASSWORD || 'Account@123';
    const hrUsername = process.env.HR_USERNAME || 'hr';
    const hrPass = process.env.HR_PASSWORD || 'Hr@123';

    async function ensureUser(username, plainPassword, role) {
      const existing = await db.get('SELECT id FROM users WHERE username = ?', username);
      if (!existing) {
        const hash = await bcrypt.hash(plainPassword, 10);
        await db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', username, hash, role);
        console.log(`[db:seed] Created user ${username} (${role})`);
      }
    }

    await ensureUser(adminUsername, adminPass, 'admin');
    await ensureUser(accountantUsername, accountantPass, 'accountant');
    await ensureUser(hrUsername, hrPass, 'hr');
  } catch (err) {
    console.error('[db:seed] failed:', err);
  }

  console.log('[db] SQLite file path:', DB_FILE_PATH);
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
