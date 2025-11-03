// db.js
// Robust DB initializer & helpers for PGS-ERP
// - honors process.env.DB_PATH
// - auto-creates parent dir
// - ensures core tables + idempotent migrations
//
// Usage:
//   import initDB, { getDB, all, get, run, exec } from './db.js';
//   await initDB(); // at server startup

import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const DEFAULT_DB = path.join(process.cwd(), 'data', 'database.db'); // local dev fallback
const DB_PATH = (process.env.DB_PATH && process.env.DB_PATH.trim()) || DEFAULT_DB;

let dbInstance = null;

async function ensureDir(filePath) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log('[db] Created DB directory:', dir);
    }
  } catch (err) {
    console.warn('[db] Could not create DB directory:', err && err.message ? err.message : err);
  }
}

async function createCoreTables(db) {
  // Create minimal core tables used by the app.
  // Keep columns conservative — controllers may rely on specific names.
  await db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      address_line1 TEXT,
      address_line2 TEXT,
      po_dated TEXT,
      state TEXT,
      district TEXT,
      contact TEXT,
      telephone TEXT,
      email TEXT,
      gst_number TEXT,
      cgst REAL,
      sgst REAL,
      igst REAL,
      monthly_rate REAL
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      employee_id TEXT,
      role TEXT,
      address_line1 TEXT,
      address_line2 TEXT,
      state TEXT,
      district TEXT,
      contact TEXT,
      salary_per_day REAL,
      joined_on TEXT
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS attendances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER,
      date TEXT,
      present INTEGER DEFAULT 0,
      site_id INTEGER,
      notes TEXT
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS deductions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER,
      amount REAL,
      reason TEXT,
      date TEXT
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER,
      invoice_number TEXT,
      period_start TEXT,
      period_end TEXT,
      amount REAL,
      created_at TEXT,
      pdf_path TEXT
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS salaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER,
      month TEXT,
      amount REAL,
      generated_at TEXT,
      pdf_path TEXT
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resource TEXT,
      resource_id INTEGER,
      action TEXT,         -- e.g. 'edit' or 'delete'
      payload TEXT,        -- JSON string with requested changes
      approver_id INTEGER, -- user id of approver (added by migration if missing)
      status TEXT DEFAULT 'pending',
      created_at TEXT
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password_hash TEXT,
      role TEXT,
      created_at TEXT
    );
  `);
}

async function runMigrations(db) {
  try {
    // clients: ensure monthly_rate, gst_number, igst exist (idempotent)
    const clientCols = await db.all("PRAGMA table_info('clients');");
    const clientColNames = (clientCols || []).map(c => c.name);

    if (!clientColNames.includes('monthly_rate')) {
      console.log('[db] Migration: adding clients.monthly_rate');
      await db.exec("ALTER TABLE clients ADD COLUMN monthly_rate REAL;");
    } else {
      console.log('[db] Migration: clients.monthly_rate exists');
    }

    if (!clientColNames.includes('gst_number')) {
      console.log('[db] Migration: adding clients.gst_number');
      await db.exec("ALTER TABLE clients ADD COLUMN gst_number TEXT;");
    } else {
      // likely already exists; keep silent
    }

    if (!clientColNames.includes('igst')) {
      console.log('[db] Migration: adding clients.igst');
      await db.exec("ALTER TABLE clients ADD COLUMN igst REAL;");
    } else {
      // ok
    }

    // requests: ensure approver_id exists
    const reqCols = await db.all("PRAGMA table_info('requests');");
    const reqColNames = (reqCols || []).map(c => c.name);
    if (!reqColNames.includes('approver_id')) {
      console.log('[db] Migration: adding requests.approver_id');
      await db.exec("ALTER TABLE requests ADD COLUMN approver_id INTEGER;");
    } else {
      console.log('[db] Migration: requests.approver_id exists');
    }

    // If you need to drop legacy 'address' column, do that via safe rebuild migration separately.
  } catch (merr) {
    console.warn('[db] Migration step failed (non-fatal):', merr && merr.message ? merr.message : merr);
  }
}

async function initDB() {
  if (dbInstance) return dbInstance;

  // Ensure parent directory exists
  await ensureDir(DB_PATH);

  // Open DB
  try {
    dbInstance = await open({
      filename: DB_PATH,
      driver: sqlite3.Database
    });
    console.log('[db] SQLite opened at', DB_PATH);
  } catch (err) {
    console.error('[db] Failed to open DB at', DB_PATH, '->', err && err.stack ? err.stack : err);
    // Fallback to in-project DB to allow process to start (but log clearly)
    const fallback = DEFAULT_DB;
    try {
      await ensureDir(fallback);
      dbInstance = await open({ filename: fallback, driver: sqlite3.Database });
      console.warn('[db] Falling back to in-project DB at', fallback);
    } catch (err2) {
      console.error('[db] Fatal: could not open fallback DB at', fallback, err2 && err2.stack ? err2.stack : err2);
      throw err2; // let process crash so platform shows failure
    }
  }

  // Create core tables if missing
  try {
    await createCoreTables(dbInstance);
  } catch (cErr) {
    console.error('[db] Error creating core tables:', cErr && cErr.stack ? cErr.stack : cErr);
    // continue; table creation problems will surface later
  }

  // Run idempotent migrations
  await runMigrations(dbInstance);

  console.log('[db] initialization completed');
  return dbInstance;
}

// Convenience helpers for controllers
async function getDB() {
  if (!dbInstance) {
    await initDB();
  }
  return dbInstance;
}

async function all(sql, params = []) {
  const db = await getDB();
  return db.all(sql, params);
}

async function get(sql, params = []) {
  const db = await getDB();
  return db.get(sql, params);
}

async function run(sql, params = []) {
  const db = await getDB();
  return db.run(sql, params);
}

async function exec(sql) {
  const db = await getDB();
  return db.exec(sql);
}

export default initDB;
export { getDB, all, get, run, exec };
