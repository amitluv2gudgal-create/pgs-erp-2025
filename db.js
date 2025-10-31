// db.js
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'database.db');

let db = null;

/**
 * Initialize database (creates / migrates tables).
 * Exported as initDB to match server.js import.
 */
export async function initDB() {
  try {
    // Ensure folder exists
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    db = await open({
      filename: DB_PATH,
      driver: sqlite3.Database
    });

    console.log('[db] opened at', DB_PATH);

    // Create core tables (fixed SQL)
    await db.exec(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT
    );`);

    await db.exec(`CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      address TEXT,
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
      igst REAL
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
      FOREIGN KEY(employee_id) REFERENCES employees(id),
      FOREIGN KEY(submitted_by) REFERENCES security_supervisors(id),
      FOREIGN KEY(client_id) REFERENCES clients(id)
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

    // perform safe migrations (add missing columns) — idempotent
    await ensureClientExtraFields();
    await ensureRequestsApproverColumn(); // placeholder (no-op if not needed)
    await dropLegacyClientAddressColumn(); // placeholder (no-op if not needed)

    console.log('[db] initialization completed');
    return db;
  } catch (err) {
    console.error('[db] initDB failed:', err);
    throw err;
  }
}

/**
 * Migration helpers (safe; idempotent).
 * - ensureClientExtraFields adds gst_number and igst if missing.
 * - ensureRequestsApproverColumn and dropLegacyClientAddressColumn are kept to match server import statements (attempt safe actions or no-op).
 */

export async function ensureClientExtraFields() {
  if (!db) throw new Error('DB not initialized');
  try {
    const rows = await db.all("PRAGMA table_info(clients);");
    const colNames = rows.map(r => r.name);
    if (!colNames.includes('gst_number')) {
      console.log('[db] Adding gst_number column to clients');
      await db.exec("ALTER TABLE clients ADD COLUMN gst_number TEXT;");
    } else {
      console.log('[db] clients.gst_number exists');
    }
    if (!colNames.includes('igst')) {
      console.log('[db] Adding igst column to clients');
      await db.exec("ALTER TABLE clients ADD COLUMN igst REAL;");
    } else {
      console.log('[db] clients.igst exists');
    }
  } catch (err) {
    // If ALTER TABLE fails in some environments, log and rethrow
    console.error('[db] ensureClientExtraFields error:', err);
    throw err;
  }
}

export async function ensureRequestsApproverColumn() {
  if (!db) throw new Error('DB not initialized');
  try {
    // If you want an approver column on requests in future, add here safely.
    const rows = await db.all("PRAGMA table_info(requests);");
    const colNames = rows.map(r => r.name);
    if (!colNames.includes('approver_id')) {
      console.log('[db] Adding approver_id to requests (if needed)');
      // add as nullable so existing rows are fine
      await db.exec("ALTER TABLE requests ADD COLUMN approver_id INTEGER;");
    } else {
      console.log('[db] requests.approver_id exists');
    }
  } catch (err) {
    // tolerate failures (some older DBs may not need this)
    console.warn('[db] ensureRequestsApproverColumn warning:', err.message || err);
  }
}

export async function dropLegacyClientAddressColumn() {
  // Some older DBs may have an old column named "address" and you might want to drop it.
  // SQLite does not support DROP COLUMN directly in older versions — implementing safely would require table rebuild.
  // For now, we just log and leave the column intact. If you want to remove it, implement backup+recreate logic here.
  console.log('[db] dropLegacyClientAddressColumn: no-op (preserving legacy address column)');
  return;
}

// Basic query/run wrappers (exported so controllers can import)
export const query = async (sql, params = []) => {
  if (!db) throw new Error('DB not initialized');
  return db.all(sql, params);
};
export const run = async (sql, params = []) => {
  if (!db) throw new Error('DB not initialized');
  // sqlite `run` returns a Statement result with lastID / changes when using node-sqlite3 wrapper via open()
  return db.run(sql, params);
};

// Provide compatibility exports expected by server.js
export const dbModule = { initDB, ensureClientExtraFields, ensureRequestsApproverColumn, dropLegacyClientAddressColumn, query, run };
export { DB_PATH };

// Default export for backward compatibility
export default {
  initDB,
  ensureClientExtraFields,
  ensureRequestsApproverColumn,
  dropLegacyClientAddressColumn,
  query,
  run,
  dbModule,
  DB_PATH
};
