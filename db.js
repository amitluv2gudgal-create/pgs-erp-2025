// db.js
// ES module, robust sqlite initialization with safe fallback for Render
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import fs from 'fs';

// Exported DB path (will be assigned to resolved path)
export let DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'database.db');

let db = null;

/**
 * Resolve a safe DB path:
 * - prefer process.env.DB_PATH if inside project root
 * - otherwise fall back to ./data/database.db inside project root
 * - ensure directory exists
 */
function resolveDbPath() {
  const projectRoot = process.cwd(); // e.g. /opt/render/project/src on Render
  const requested = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : path.join(projectRoot, 'data', 'database.db');
  let resolved = requested;

  // If requested path is outside project root, fallback to project data folder
  if (!resolved.startsWith(projectRoot)) {
    resolved = path.join(projectRoot, 'data', 'database.db');
    console.warn('[db] DB_PATH pointed outside project root; falling back to in-project DB at', resolved);
  }

  // Ensure directory exists; try to create if missing
  const dir = path.dirname(resolved);
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log('[db] Created DB directory:', dir);
    }
  } catch (err) {
    console.error('[db] Could not create DB directory:', dir, err && err.message ? err.message : err);
    // Final fallback to project data folder if creation failed
    const fallback = path.join(projectRoot, 'data', 'database.db');
    try {
      if (!fs.existsSync(path.dirname(fallback))) fs.mkdirSync(path.dirname(fallback), { recursive: true });
      resolved = fallback;
      console.warn('[db] Falling back to', resolved);
    } catch (err2) {
      console.error('[db] Final fallback failed:', err2 && err2.message ? err2.message : err2);
      // Let caller handle the error when attempting to open DB
    }
  }

  return resolved;
}

/**
 * Initialize DB: open connection, create tables, run safe migrations.
 * Exported as initDB (uppercase D) to match server.js import.
 */
export async function initDB() {
  try {
    // Determine safe path and assign exported DB_PATH
    const resolved = resolveDbPath();
    DB_PATH = resolved;

    db = await open({
      filename: DB_PATH,
      driver: sqlite3.Database
    });

    console.log('[db] opened at', DB_PATH);

    // Core table creations (idempotent)
    await db.exec(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT
    );`);

    await db.exec(`CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      address_line1 TEXT,
      address_line2 TEXT,
      po_dated TEXT,
      state TEXT,
      district TEXT,
      contact_person TEXT,
      telephone TEXT,
      email TEXT,
      gst_number TEXT,
      cgst REAL DEFAULT 0,
      sgst REAL DEFAULT 0,
      igst REAL DEFAULT 0,
      categories TEXT
    );`);

    await db.exec(`CREATE TABLE IF NOT EXISTS client_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER,
      category TEXT,
      monthly_rate REAL,
      FOREIGN KEY(client_id) REFERENCES clients(id)
    );`);

    await db.exec(`CREATE TABLE IF NOT EXISTS employees (
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
    );`);

    await db.exec(`CREATE TABLE IF NOT EXISTS attendances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER,
      date TEXT,
      present INTEGER,
      submitted_by INTEGER,
      client_id INTEGER,
      status TEXT DEFAULT 'pending',
      FOREIGN KEY(employee_id) REFERENCES employees(id)
    );`);

    await db.exec(`CREATE TABLE IF NOT EXISTS deductions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER,
      amount REAL,
      reason TEXT,
      date TEXT,
      month TEXT,
      note TEXT,
      FOREIGN KEY(employee_id) REFERENCES employees(id)
    );`);

    await db.exec(`CREATE TABLE IF NOT EXISTS invoices (
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
    );`);

    await db.exec(`CREATE TABLE IF NOT EXISTS salaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER,
      month TEXT,
      attendance_days INTEGER,
      amount REAL,
      deductions REAL,
      net_amount REAL,
      salary_date TEXT,
      FOREIGN KEY(employee_id) REFERENCES employees(id)
    );`);

    await db.exec(`CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requester_id INTEGER,
      action TEXT,
      table_name TEXT,
      record_id INTEGER,
      data TEXT,
      new_data TEXT,
      status TEXT DEFAULT 'pending',
      approver_id INTEGER,
      approver_comment TEXT,
      FOREIGN KEY(requester_id) REFERENCES users(id)
    );`);

    await db.exec(`CREATE TABLE IF NOT EXISTS security_supervisors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      username TEXT UNIQUE,
      password TEXT,
      client_id INTEGER,
      site_name TEXT,
      created_by INTEGER,
      FOREIGN KEY(client_id) REFERENCES clients(id),
      FOREIGN KEY(created_by) REFERENCES users(id)
    );`);

    // Safe migrations: add missing columns if needed
    await ensureClientExtraFields();
    await ensureRequestsApproverColumn();

    console.log('[db] initialization completed');
    return db;
  } catch (err) {
    console.error('[db] initDB failed:', err && err.message ? err.message : err);
    throw err;
  }
}

/**
 * Migration helpers (idempotent)
 */
export async function ensureClientExtraFields() {
  if (!db) throw new Error('DB not initialized');
  try {
    const rows = await db.all("PRAGMA table_info(clients);");
    const colNames = Array.isArray(rows) ? rows.map(r => r.name) : [];
    if (!colNames.includes('gst_number')) {
      console.log('[db] Adding gst_number column to clients');
      await db.exec("ALTER TABLE clients ADD COLUMN gst_number TEXT;");
    } else {
      console.log('[db] clients.gst_number exists');
    }
    if (!colNames.includes('igst')) {
      console.log('[db] Adding igst column to clients');
      await db.exec("ALTER TABLE clients ADD COLUMN igst REAL DEFAULT 0;");
    } else {
      console.log('[db] clients.igst exists');
    }
    if (!colNames.includes('cgst')) {
      console.log('[db] Adding cgst column to clients');
      await db.exec("ALTER TABLE clients ADD COLUMN cgst REAL DEFAULT 0;");
    }
    if (!colNames.includes('sgst')) {
      console.log('[db] Adding sgst column to clients');
      await db.exec("ALTER TABLE clients ADD COLUMN sgst REAL DEFAULT 0;");
    }
    if (!colNames.includes('contact_person')) {
      console.log('[db] Adding contact_person column to clients');
      await db.exec("ALTER TABLE clients ADD COLUMN contact_person TEXT;");
    }
    if (!colNames.includes('categories')) {
      console.log('[db] Adding categories column to clients');
      await db.exec("ALTER TABLE clients ADD COLUMN categories TEXT;");
    }
  } catch (err) {
    console.error('[db] ensureClientExtraFields error:', err && err.message ? err.message : err);
    throw err;
  }
}

export async function ensureRequestsApproverColumn() {
  if (!db) throw new Error('DB not initialized');
  try {
    const rows = await db.all("PRAGMA table_info(requests);");
    const colNames = Array.isArray(rows) ? rows.map(r => r.name) : [];
    if (!colNames.includes('approver_id')) {
      console.log('[db] Adding approver_id to requests');
      await db.exec("ALTER TABLE requests ADD COLUMN approver_id INTEGER;");
    } else {
      console.log('[db] requests.approver_id exists');
    }
  } catch (err) {
    // tolerate and log
    console.warn('[db] ensureRequestsApproverColumn warning:', err && err.message ? err.message : err);
  }
}

/**
 * Simple query/run wrappers (export to controllers)
 */
export const query = async (sql, params = []) => {
  if (!db) throw new Error('DB not initialized');
  return db.all(sql, params);
};

export const run = async (sql, params = []) => {
  if (!db) throw new Error('DB not initialized');
  return db.run(sql, params);
};

// Provide a dbModule object and named exports expected by server.js
export const dbModule = {
  initDB,
  ensureClientExtraFields,
  ensureRequestsApproverColumn,
  query,
  run
};

// Default export for backward compatibility
export default {
  initDB,
  ensureClientExtraFields,
  ensureRequestsApproverColumn,
  query,
  run,
  dbModule,
  DB_PATH
};
