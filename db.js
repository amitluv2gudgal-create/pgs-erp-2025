// db.js — robust SQLite with persistent disk + singleton connection (ESM)
import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

// ---- Resolve a single absolute DB path (stable across CWDs) ----
const DEFAULT_DB_PATH = path.resolve(process.cwd(), 'data', 'database.db'); // e.g. C:\...\PGS-ERP\data\database.db
export const DB_FILE = process.env.DATABASE_FILE ? path.resolve(process.cwd(), process.env.DATABASE_FILE) : DEFAULT_DB_PATH;

let db; // singleton

async function ensureFolderAndMigrateLegacy() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // One-time migration: if DB_FILE doesn't exist but legacy "./database.db" exists, copy it.
  const legacyPath = path.resolve(process.cwd(), 'database.db');
  if (!fs.existsSync(DB_FILE) && fs.existsSync(legacyPath)) {
    try {
      fs.copyFileSync(legacyPath, DB_FILE);
      console.log(`[db] Migrated legacy DB ${legacyPath} -> ${DB_FILE}`);
    } catch (e) {
      console.warn('[db] Legacy DB copy failed:', e);
    }
  }
}

// Optional: create helpful indexes (idempotent in SQLite)
async function ensureIndexes(conn) {
  await conn.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_client_categories_client ON client_categories(client_id);
    CREATE INDEX IF NOT EXISTS idx_employees_client ON employees(client_id);
    CREATE INDEX IF NOT EXISTS idx_attendances_employee ON attendances(employee_id);
    CREATE INDEX IF NOT EXISTS idx_attendances_client ON attendances(client_id);
    CREATE INDEX IF NOT EXISTS idx_deductions_employee ON deductions(employee_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
    CREATE INDEX IF NOT EXISTS idx_salaries_employee ON salaries(employee_id);
    CREATE INDEX IF NOT EXISTS idx_security_supervisors_client ON security_supervisors(client_id);
  `);
}

export async function initDB() {
  if (db) return db;

  await ensureFolderAndMigrateLegacy();

  db = await open({
    filename: DB_FILE,
    driver: sqlite3.Database
  });

  // Stability & safety
  await db.exec('PRAGMA journal_mode = WAL;');     // better durability & concurrency
  await db.exec('PRAGMA foreign_keys = ON;');      // enforce FK constraints
  await db.exec('PRAGMA busy_timeout = 5000;');    // avoid "database is locked" in bursts

  // Tables: ONLY create if not exists (never drop on boot)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT
    );

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      address TEXT,
      contact TEXT,
      telephone TEXT,
      email TEXT,
      cgst REAL,
      sgst REAL
    );

    CREATE TABLE IF NOT EXISTS client_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER,
      category TEXT,
      monthly_rate REAL,
      FOREIGN KEY(client_id) REFERENCES clients(id)
    );

    CREATE TABLE IF NOT EXISTS employees (
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
    );

    -- 'submitted_by' stored as TEXT (e.g., 'hr', 'supervisor')
    CREATE TABLE IF NOT EXISTS attendances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER,
      date TEXT,
      present INTEGER,                -- 0/1/2 supported
      submitted_by TEXT,              -- 'hr' | 'supervisor'
      client_id INTEGER,
      status TEXT DEFAULT 'pending',  -- 'pending'|'verified'|'rejected'
      FOREIGN KEY(employee_id) REFERENCES employees(id),
      FOREIGN KEY(client_id) REFERENCES clients(id)
    );

    CREATE TABLE IF NOT EXISTS deductions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER,
      amount REAL,
      reason TEXT,
      date TEXT,
      month TEXT,
      FOREIGN KEY(employee_id) REFERENCES employees(id)
    );

    CREATE TABLE IF NOT EXISTS invoices (
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
    );

    CREATE TABLE IF NOT EXISTS salaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER,
      month TEXT,
      attendance_days INTEGER,
      amount REAL,
      deductions REAL,
      net_amount REAL,
      salary_date TEXT,
      FOREIGN KEY(employee_id) REFERENCES employees(id)
    );

    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requester_id INTEGER,
      action TEXT,
      table_name TEXT,
      record_id INTEGER,
      data TEXT,
      new_data TEXT,
      status TEXT DEFAULT 'pending',
      FOREIGN KEY(requester_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS security_supervisors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      username TEXT UNIQUE,
      password TEXT,
      client_id INTEGER,
      site_name TEXT,
      created_by INTEGER,
      FOREIGN KEY(client_id) REFERENCES clients(id),
      FOREIGN KEY(created_by) REFERENCES users(id)
    );
  `);

  await ensureIndexes(db);

  console.log('[db] SQLite initialized at', DB_FILE);
  return db;
}

// Simple helpers
export async function query(sql, params = []) {
  const conn = await initDB();
  return conn.all(sql, params);
}

export async function run(sql, params = []) {
  const conn = await initDB();
  const stmt = await conn.prepare(sql);
  try {
    await stmt.bind(params);
    const result = await stmt.run();
    // Normalize return object
    return {
      insertId: result?.lastID ?? null,
      lastID: result?.lastID ?? null,
      changes: result?.changes ?? 0
    };
  } finally {
    await stmt.finalize();
  }
}

export default { initDB, query, run, DB_FILE };
