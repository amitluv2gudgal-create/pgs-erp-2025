// db.js
// Robust ES-module sqlite initialization, migrations, and seeding for PGS-ERP
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcrypt';

// Exported DB path (may be adjusted by resolveDbPath())
export let DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'database.db');

let db = null;

/** Resolve and ensure DB path is inside project */
function resolveDbPath() {
  const projectRoot = process.cwd();
  const requested = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : path.join(projectRoot, 'data', 'database.db');
  let resolved = requested;

  if (!resolved.startsWith(projectRoot)) {
    resolved = path.join(projectRoot, 'data', 'database.db');
    console.warn('[db] DB_PATH pointed outside project root; falling back to in-project DB at', resolved);
  }

  const dir = path.dirname(resolved);
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log('[db] Created DB directory:', dir);
    }
  } catch (err) {
    console.error('[db] Could not create DB directory:', dir, err && err.message ? err.message : err);
    // fallback: try project data folder
    const fallback = path.join(projectRoot, 'data', 'database.db');
    try {
      if (!fs.existsSync(path.dirname(fallback))) fs.mkdirSync(path.dirname(fallback), { recursive: true });
      resolved = fallback;
      console.warn('[db] Falling back to', resolved);
    } catch (err2) {
      console.error('[db] Final fallback failed:', err2 && err2.message ? err2.message : err2);
    }
  }
  return resolved;
}

/** Utility: safely check if a table exists */
async function tableExists(tableName) {
  if (!db) throw new Error('DB not initialized');
  try {
    const rows = await db.all("SELECT name FROM sqlite_master WHERE type='table' AND name = ?", [tableName]);
    return Array.isArray(rows) && rows.length > 0;
  } catch (err) {
    console.warn('[db] tableExists error for', tableName, err && err.message ? err.message : err);
    return false;
  }
}

/** Create core tables (idempotent) */
async function createCoreTables() {
  if (!db) throw new Error('DB not initialized');

  // Create users table
  await db.exec(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT
  );`);

  // clients
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

  // client_categories (optional)
  await db.exec(`CREATE TABLE IF NOT EXISTS client_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER,
    category TEXT,
    monthly_rate REAL,
    FOREIGN KEY(client_id) REFERENCES clients(id)
  );`);

  // employees
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

  // attendances
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

  // deductions
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

  // invoices
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

  // salaries
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

  // requests
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

  // security_supervisors
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
}

/** Ensure certain client columns exist (safe) */
export async function ensureClientExtraFields() {
  if (!db) throw new Error('DB not initialized');
  try {
    const exists = await tableExists('clients');
    if (!exists) {
      console.log('[db] ensureClientExtraFields: clients table does not exist; skipping');
      return;
    }
    const rows = await db.all("PRAGMA table_info(clients);");
    const colNames = Array.isArray(rows) ? rows.map(r => r.name) : [];
    const toAdd = [];
    if (!colNames.includes('gst_number')) toAdd.push("ALTER TABLE clients ADD COLUMN gst_number TEXT;");
    if (!colNames.includes('igst')) toAdd.push("ALTER TABLE clients ADD COLUMN igst REAL DEFAULT 0;");
    if (!colNames.includes('cgst')) toAdd.push("ALTER TABLE clients ADD COLUMN cgst REAL DEFAULT 0;");
    if (!colNames.includes('sgst')) toAdd.push("ALTER TABLE clients ADD COLUMN sgst REAL DEFAULT 0;");
    if (!colNames.includes('contact_person')) toAdd.push("ALTER TABLE clients ADD COLUMN contact_person TEXT;");
    if (!colNames.includes('categories')) toAdd.push("ALTER TABLE clients ADD COLUMN categories TEXT;");
    for (const sql of toAdd) {
      try {
        await db.exec(sql);
        console.log('[db] ran migration:', sql);
      } catch (err) {
        console.warn('[db] migration failed (ignored):', sql, err && err.message ? err.message : err);
      }
    }
  } catch (err) {
    console.error('[db] ensureClientExtraFields error:', err && err.message ? err.message : err);
    throw err;
  }
}

/** Ensure requests.approver_id exists (safe) */
export async function ensureRequestsApproverColumn() {
  if (!db) throw new Error('DB not initialized');
  try {
    const exists = await tableExists('requests');
    if (!exists) {
      console.log('[db] ensureRequestsApproverColumn: requests table does not exist; skipping');
      return;
    }
    const rows = await db.all("PRAGMA table_info(requests);");
    const colNames = Array.isArray(rows) ? rows.map(r => r.name) : [];
    if (!colNames.includes('approver_id')) {
      await db.exec("ALTER TABLE requests ADD COLUMN approver_id INTEGER;");
      console.log('[db] Added approver_id to requests');
    } else {
      console.log('[db] requests.approver_id exists');
    }
  } catch (err) {
    console.warn('[db] ensureRequestsApproverColumn warning:', err && err.message ? err.message : err);
  }
}

/**
 * dropLegacyClientAddressColumn
 * exported because server.js expects it. Safe and idempotent.
 */
export async function dropLegacyClientAddressColumn() {
  if (!db) throw new Error('DB not initialized');
  try {
    const exists = await tableExists('clients');
    if (!exists) {
      console.log('[db] dropLegacyClientAddressColumn: clients table missing; skipping');
      return;
    }
    const rows = await db.all("PRAGMA table_info(clients);");
    const colNames = Array.isArray(rows) ? rows.map(r => r.name) : [];
    const legacyCandidates = ['Address', 'Contact', 'address', 'contact'];
    for (const legacy of legacyCandidates) {
      if (colNames.includes(legacy)) {
        try {
          await db.exec(`ALTER TABLE clients DROP COLUMN "${legacy}";`);
          console.log(`[db] Dropped legacy column "${legacy}" from clients table.`);
        } catch (errDrop) {
          console.warn(`[db] Could not DROP COLUMN "${legacy}". SQLite may not support DROP COLUMN. Error:`, errDrop && errDrop.message ? errDrop.message : errDrop);
        }
      }
    }
  } catch (err) {
    console.error('[db] dropLegacyClientAddressColumn failed:', err && err.message ? err.message : err);
    throw err;
  }
}

/** Seed initial data (idempotent). Creates default accountant user & demo client/employee when missing. */
async function seedInitialData() {
  if (!db) throw new Error('DB not initialized');
  try {
    // Ensure a default 'accountant' user exists
    const userRows = await db.all("SELECT id FROM users WHERE username = 'accountant' LIMIT 1;");
    if (!userRows || userRows.length === 0) {
      const pw = process.env.INIT_ADMIN_PW || 'rohit123';
      const hash = await bcrypt.hash(pw, 10);
      await db.run('INSERT INTO users (username,password,role) VALUES (?, ?, ?)', ['accountant', hash, 'accountant']);
      console.log('[db] seeded default user: accountant');
    } else {
      console.log('[db] user accountant already exists; skipping seed');
    }

    // Seed demo client + employee if clients table empty
    const clientsCount = await db.all('SELECT COUNT(*) as cnt FROM clients;');
    const cnt = Array.isArray(clientsCount) && clientsCount[0] ? Number(clientsCount[0].cnt) : 0;
    if (!cnt || cnt === 0) {
      await db.run(`INSERT INTO clients (name,address_line1,address_line2,po_dated,state,district,contact_person,telephone,email,gst_number,cgst,sgst,igst,categories)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?);`,
        ['Demo Client Pvt Ltd', 'House 12, Business Park', 'Site Office', '2025-09-01', 'Maharashtra', 'Mumbai', 'Mr. Rahul', '9876543210', 'demo@client.com', '27ABCDE1234F2Z5', 9, 9, 0, 'Security']);
      const cidRow = await db.all("SELECT id FROM clients WHERE name = 'Demo Client Pvt Ltd' LIMIT 1;");
      const cid = cidRow && cidRow[0] ? cidRow[0].id : null;
      if (cid) {
        await db.run(`INSERT INTO employees (name,father_name,local_address,permanent_address,telephone,email,marital_status,next_kin_name,next_kin_telephone,identifier_name,epf_number,esic_number,criminal_record,salary_per_month,category,client_id)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?);`,
          ['Ramesh Kumar','S. Kumar','Near Market','Village Road','9998887777','ramesh@example.com','Married','Sita Devi','9998880000','Aadhar 1234','EPF123','ESIC123','No',12000,'Security Guard', cid ]);
      }
      console.log('[db] seeded demo client and employee');
    } else {
      console.log('[db] clients table has data; skipping demo seed');
    }
  } catch (err) {
    console.error('[db] seedInitialData error:', err && err.message ? err.message : err);
    // Don't throw — seeding failure should not block startup in many cases
  }
}

/** initDB: open DB, create tables, run migrations, drop legacy columns, seed initial data */
export async function initDB() {
  try {
    const resolved = resolveDbPath();
    DB_PATH = resolved;

    db = await open({
      filename: DB_PATH,
      driver: sqlite3.Database
    });

    console.log('[db] opened at', DB_PATH);

    // 1) Create core tables first (idempotent)
    await createCoreTables();

    // 2) Run safe migrations only if tables exist
    try {
      await ensureRequestsApproverColumn();
    } catch (err) {
      console.warn('[db] ensureRequestsApproverColumn warning (ignored):', err && err.message ? err.message : err);
    }
    try {
      await ensureClientExtraFields();
    } catch (err) {
      console.warn('[db] ensureClientExtraFields warning (ignored):', err && err.message ? err.message : err);
    }

    // 3) Safe legacy cleanup (no-op if table missing)
    try {
      await dropLegacyClientAddressColumn();
    } catch (err) {
      console.warn('[db] dropLegacyClientAddressColumn warning (ignored):', err && err.message ? err.message : err);
    }

    // 4) Seed minimal data so deploys remain usable
    try {
      await seedInitialData();
    } catch (err) {
      console.warn('[db] seedInitialData warning (ignored):', err && err.message ? err.message : err);
    }

    console.log('[db] initialization completed');
    return db;
  } catch (err) {
    console.error('[db] initDB failed:', err && err.message ? err.message : err);
    throw err;
  }
}

/** Simple query/run wrappers (exported for controllers) */
export const query = async (sql, params = []) => {
  if (!db) throw new Error('DB not initialized');
  return db.all(sql, params);
};

export const run = async (sql, params = []) => {
  if (!db) throw new Error('DB not initialized');
  return db.run(sql, params);
};

export const dbModule = {
  initDB,
  ensureClientExtraFields,
  ensureRequestsApproverColumn,
  dropLegacyClientAddressColumn,
  seedInitialData,
  query,
  run
};

export default {
  initDB,
  ensureClientExtraFields,
  ensureRequestsApproverColumn,
  dropLegacyClientAddressColumn,
  seedInitialData,
  query,
  run,
  dbModule,
  DB_PATH
};
