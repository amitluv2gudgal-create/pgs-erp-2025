// db.js — Postgres (Neon) adapter keeping query/run signatures
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

export const DB_URL = process.env.DATABASE_URL; // e.g. postgres://...neon.tech/db?sslmode=require
if (!DB_URL) console.warn('[db] DATABASE_URL is not set');

const pool = new Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false } // Neon requires SSL
});

// Ensure schema once
let booted = false;
async function ensureSchema() {
  if (booted) return;
  booted = true;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT
      );

      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        name TEXT,
        address TEXT,
        contact TEXT,
        telephone TEXT,
        email TEXT,
        cgst REAL,
        sgst REAL
      );

      CREATE TABLE IF NOT EXISTS client_categories (
        id SERIAL PRIMARY KEY,
        client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        category TEXT,
        monthly_rate REAL
      );

      CREATE TABLE IF NOT EXISTS employees (
        id SERIAL PRIMARY KEY,
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
        client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS attendances (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
        date TEXT,
        present INTEGER,
        submitted_by TEXT,
        client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        status TEXT DEFAULT 'pending'
      );

      CREATE TABLE IF NOT EXISTS deductions (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
        amount REAL,
        reason TEXT,
        date TEXT,
        month TEXT
      );

      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        month TEXT,
        invoice_no TEXT,
        subtotal REAL,
        service_charges REAL,
        total REAL,
        cgst_amount REAL,
        sgst_amount REAL,
        grand_total REAL,
        invoice_date TEXT
      );

      CREATE TABLE IF NOT EXISTS salaries (
        id SERIAL PRIMARY KEY,
        employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
        month TEXT,
        attendance_days INTEGER,
        amount REAL,
        deductions REAL,
        net_amount REAL,
        salary_date TEXT
      );

      CREATE TABLE IF NOT EXISTS requests (
        id SERIAL PRIMARY KEY,
        requester_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action TEXT,
        table_name TEXT,
        record_id INTEGER,
        data TEXT,
        new_data TEXT,
        status TEXT DEFAULT 'pending'
      );

      CREATE TABLE IF NOT EXISTS security_supervisors (
        id SERIAL PRIMARY KEY,
        name TEXT,
        username TEXT UNIQUE,
        password TEXT,
        client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        site_name TEXT,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS admin_password_resets (
        id SERIAL PRIMARY KEY,
        admin_id INTEGER,
        target_user_id INTEGER,
        at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Helpful indexes
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_client_categories_client ON client_categories(client_id);
      CREATE INDEX IF NOT EXISTS idx_employees_client ON employees(client_id);
      CREATE INDEX IF NOT EXISTS idx_att_employee ON attendances(employee_id);
      CREATE INDEX IF NOT EXISTS idx_att_client ON attendances(client_id);
    `);

    await client.query('COMMIT');
    console.log('[db] Postgres schema ensured');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[db] Schema ensure error:', e);
    throw e;
  } finally {
    client.release();
  }
}

export async function query(sql, params = []) {
  await ensureSchema();
  const res = await pool.query(sql, params);
  return res.rows;
}

export async function run(sql, params = []) {
  await ensureSchema();
  const res = await pool.query(sql, params);
  // Emulate sqlite-style result
  const first = res.rows?.[0];
  return {
    insertId: first?.id ?? null,
    lastID: first?.id ?? null,
    changes: res.rowCount ?? 0,
    rows: res.rows
  };
}

export default { query, run, DB_URL };
