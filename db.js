// db.js
// Robust DB initializer & helpers for PGS-ERP
// - honors process.env.DB_PATH
// - auto-creates parent dir
// - ensures core tables + idempotent migrations
// - provides dropLegacyClientAddressColumn() to safely remove legacy 'address' column
//
// Exports:
//   default initDB()
//   getDB, all, get, run, exec, query, queryOne
//   DB_PATH, DEFAULT_DB
//   dbModule
//   dropLegacyClientAddressColumn

import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

export const DEFAULT_DB = path.join(process.cwd(), 'data', 'database.db'); // local dev fallback
export const DB_PATH = (process.env.DB_PATH && process.env.DB_PATH.trim()) || DEFAULT_DB;

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
      action TEXT,
      payload TEXT,
      approver_id INTEGER,
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
    }

    if (!clientColNames.includes('igst')) {
      console.log('[db] Migration: adding clients.igst');
      await db.exec("ALTER TABLE clients ADD COLUMN igst REAL;");
    }

    const reqCols = await db.all("PRAGMA table_info('requests');");
    const reqColNames = (reqCols || []).map(c => c.name);
    if (!reqColNames.includes('approver_id')) {
      console.log('[db] Migration: adding requests.approver_id');
      await db.exec("ALTER TABLE requests ADD COLUMN approver_id INTEGER;");
    } else {
      console.log('[db] Migration: requests.approver_id exists');
    }
  } catch (merr) {
    console.warn('[db] Migration step failed (non-fatal):', merr && merr.message ? merr.message : merr);
  }
}

/**
 * Safely drop legacy 'address' column from clients table.
 * Because SQLite doesn't support DROP COLUMN directly across all versions,
 * this function:
 *  - checks if 'address' column exists
 *  - if yes, creates clients_new with desired schema,
 *  - copies data mapping address -> address_line1 when address_line1 is null,
 *  - drops old table and renames clients_new to clients.
 * Idempotent: if 'address' doesn't exist, it's a no-op.
 */
export async function dropLegacyClientAddressColumn(db) {
  // db param optional - if not provided, use shared instance
  const _db = db || (await getDB());
  try {
    const cols = await _db.all("PRAGMA table_info('clients');");
    const colNames = (cols || []).map(c => c.name);
    if (!colNames.includes('address')) {
      console.log('[db] dropLegacyClientAddressColumn: no legacy address column found (no-op)');
      return { ok: true, message: 'no-op' };
    }

    console.log('[db] dropLegacyClientAddressColumn: legacy address column found — performing safe rebuild');

    // create new table with desired schema
    await _db.exec(`
      CREATE TABLE IF NOT EXISTS clients_new (
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

    // Copy data:
    // - If address_line1 is NULL or empty, use legacy 'address' column as address_line1.
    // - If monthly_rate doesn't exist in old table, COALESCE will yield NULL (fine).
    // Use column list to avoid errors if some columns are missing.
    const hasMonthlyRate = colNames.includes('monthly_rate');
    const hasCgst = colNames.includes('cgst');
    const hasSgst = colNames.includes('sgst');

    // Build safe select mapping depending on existing columns
    const selectCols = [
      'id',
      'name',
      // fill address_line1 from address when address_line1 empty
      "CASE WHEN (address_line1 IS NULL OR TRIM(address_line1) = '') THEN address ELSE address_line1 END AS address_line1",
      'address_line2',
      'po_dated',
      'state',
      'district',
      'contact',
      'telephone',
      'email',
      // gst_number may or may not exist; use COALESCE to keep robust
      'COALESCE(gst_number, NULL) AS gst_number',
      hasCgst ? 'COALESCE(cgst, NULL) AS cgst' : 'NULL AS cgst',
      hasSgst ? 'COALESCE(sgst, NULL) AS sgst' : 'NULL AS sgst',
      'COALESCE(igst, NULL) AS igst',
      hasMonthlyRate ? 'COALESCE(monthly_rate, NULL) AS monthly_rate' : 'NULL AS monthly_rate'
    ].join(', ');

    const insertSQL = `
      INSERT INTO clients_new (id, name, address_line1, address_line2, po_dated, state, district, contact, telephone, email, gst_number, cgst, sgst, igst, monthly_rate)
      SELECT ${selectCols}
      FROM clients;
    `;

    await _db.exec('BEGIN TRANSACTION;');
    await _db.exec(insertSQL);
    await _db.exec('DROP TABLE clients;');
    await _db.exec('ALTER TABLE clients_new RENAME TO clients;');
    await _db.exec('COMMIT;');

    console.log('[db] dropLegacyClientAddressColumn: success — legacy column removed');
    return { ok: true, message: 'dropped address column' };
  } catch (err) {
    try {
      await _db.exec('ROLLBACK;');
    } catch (e) {/* ignore */}
    console.error('[db] dropLegacyClientAddressColumn failed:', err && err.stack ? err.stack : err);
    throw err;
  }
}

export async function initDB() {
  if (dbInstance) return dbInstance;

  // Ensure parent directory exists
  await ensureDir(DB_PATH);

  try {
    dbInstance = await open({
      filename: DB_PATH,
      driver: sqlite3.Database
    });
    console.log('[db] SQLite opened at', DB_PATH);
  } catch (err) {
    console.error('[db] Failed to open DB at', DB_PATH, '->', err && err.stack ? err.stack : err);
    // fallback to DEFAULT_DB so app can still start and logs show the issue
    try {
      await ensureDir(DEFAULT_DB);
      dbInstance = await open({ filename: DEFAULT_DB, driver: sqlite3.Database });
      console.warn('[db] Falling back to in-project DB at', DEFAULT_DB);
    } catch (err2) {
      console.error('[db] Fatal: could not open fallback DB at', DEFAULT_DB, err2 && err2.stack ? err2.stack : err2);
      throw err2;
    }
  }

  try {
    await createCoreTables(dbInstance);
  } catch (cErr) {
    console.error('[db] Error creating core tables:', cErr && cErr.stack ? cErr.stack : cErr);
  }

  // Run migrations first (adds monthly_rate etc.)
  await runMigrations(dbInstance);

  // Attempt to drop legacy address column if present (idempotent)
  try {
    await dropLegacyClientAddressColumn(dbInstance);
  } catch (e) {
    // warn and continue — not fatal
    console.warn('[db] dropLegacyClientAddressColumn encountered an issue (non-fatal):', e && e.message ? e.message : e);
  }

  console.log('[db] initialization completed');
  return dbInstance;
}

export default initDB;

// Convenience helpers for controllers
export async function getDB() {
  if (!dbInstance) {
    await initDB();
  }
  return dbInstance;
}

export async function all(sql, params = []) {
  const db = await getDB();
  return db.all(sql, params);
}

export async function get(sql, params = []) {
  const db = await getDB();
  return db.get(sql, params);
}

export async function run(sql, params = []) {
  const db = await getDB();
  return db.run(sql, params);
}

export async function exec(sql) {
  const db = await getDB();
  return db.exec(sql);
}

// Aliases expected by existing controllers
export async function query(sql, params = []) {
  return all(sql, params);
}
export async function queryOne(sql, params = []) {
  return get(sql, params);
}

// Compatibility bundle for server.js or other modules that import dbModule
export const dbModule = {
  initDB,
  getDB,
  all,
  get,
  run,
  exec,
  query,
  queryOne,
  DB_PATH,
  DEFAULT_DB,
  dropLegacyClientAddressColumn
};
