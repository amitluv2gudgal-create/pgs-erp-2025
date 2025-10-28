// db.js
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import dotenv from 'dotenv';

// // Load environment variables from .env file
dotenv.config();

// const DB_PATH = './database.db';
const DB_PATH = process.env.DB_PATH || './database.db';


export async function initDB() {
  const db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });

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
    attendance_days INTEGER, -- Added attendance_days
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

  return db;
}

export async function query(sql, params = []) {
  const db = await initDB();
  return await db.all(sql, params);
}

export async function run(sql, params = []) {
  const db = await initDB();
  const stmt = await db.prepare(sql);
  await stmt.bind(params);
  await stmt.run();
  const insertId = db.lastID;
  await stmt.finalize();
  return { insertId };
}


// ****************** RENDER CONFIG
// db.js
// import sqlite3 from 'sqlite3';
// import { open } from 'sqlite';
// import dotenv from 'dotenv';

// // Load environment variables from .env file
// dotenv.config();

// // Use DB_PATH from .env or fallback to default './database.db'
// const DB_PATH = process.env.DB_PATH || './database.db';

// export async function initDB() {
//   const db = await open({
//     filename: DB_PATH,
//     driver: sqlite3.Database
//   });

//   // --- USERS TABLE ---
//   await db.run(`
//     CREATE TABLE IF NOT EXISTS users (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       username TEXT UNIQUE,
//       password TEXT,
//       role TEXT
//     )
//   `);

//   // --- CLIENTS TABLE ---
//   await db.run(`
//     CREATE TABLE IF NOT EXISTS clients (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       name TEXT,
//       address TEXT,
//       contact TEXT,
//       telephone TEXT,
//       email TEXT,
//       cgst REAL,
//       sgst REAL
//     )
//   `);

//   // --- CLIENT CATEGORIES ---
//   await db.run(`
//     CREATE TABLE IF NOT EXISTS client_categories (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       client_id INTEGER,
//       category TEXT,
//       monthly_rate REAL,
//       FOREIGN KEY(client_id) REFERENCES clients(id)
//     )
//   `);

//   // --- EMPLOYEES ---
//   await db.run(`
//     CREATE TABLE IF NOT EXISTS employees (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       name TEXT,
//       father_name TEXT,
//       local_address TEXT,
//       permanent_address TEXT,
//       telephone TEXT,
//       email TEXT,
//       marital_status TEXT,
//       spouse_name TEXT,
//       next_kin_name TEXT,
//       next_kin_telephone TEXT,
//       next_kin_address TEXT,
//       identifier_name TEXT,
//       identifier_address TEXT,
//       identifier_telephone TEXT,
//       epf_number TEXT,
//       esic_number TEXT,
//       criminal_record TEXT,
//       salary_per_month REAL,
//       category TEXT,
//       client_id INTEGER,
//       FOREIGN KEY(client_id) REFERENCES clients(id)
//     )
//   `);

//   // --- ATTENDANCES ---
//   await db.run(`
//     CREATE TABLE IF NOT EXISTS attendances (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       employee_id INTEGER,
//       date TEXT,
//       present INTEGER,
//       submitted_by INTEGER,
//       client_id INTEGER,
//       status TEXT DEFAULT 'pending',
//       FOREIGN KEY(employee_id) REFERENCES employees(id),
//       FOREIGN KEY(submitted_by) REFERENCES security_supervisors(id),
//       FOREIGN KEY(client_id) REFERENCES clients(id)
//     )
//   `);

//   // --- DEDUCTIONS ---
//   await db.run(`
//     CREATE TABLE IF NOT EXISTS deductions (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       employee_id INTEGER,
//       amount REAL,
//       reason TEXT,
//       date TEXT,
//       month TEXT,
//       FOREIGN KEY(employee_id) REFERENCES employees(id)
//     )
//   `);

//   // --- INVOICES ---
//   await db.run(`
//     CREATE TABLE IF NOT EXISTS invoices (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       client_id INTEGER,
//       month TEXT,
//       invoice_no TEXT,
//       subtotal REAL,
//       service_charges REAL,
//       total REAL,
//       cgst_amount REAL,
//       sgst_amount REAL,
//       grand_total REAL,
//       invoice_date TEXT,
//       FOREIGN KEY(client_id) REFERENCES clients(id)
//     )
//   `);

//   // --- SALARIES ---
//   await db.run(`
//     CREATE TABLE IF NOT EXISTS salaries (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       employee_id INTEGER,
//       month TEXT,
//       attendance_days INTEGER,
//       amount REAL,
//       deductions REAL,
//       net_amount REAL,
//       salary_date TEXT,
//       FOREIGN KEY(employee_id) REFERENCES employees(id)
//     )
//   `);

//   // --- REQUESTS ---
//   await db.run(`
//     CREATE TABLE IF NOT EXISTS requests (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       requester_id INTEGER,
//       action TEXT,
//       table_name TEXT,
//       record_id INTEGER,
//       data TEXT,
//       new_data TEXT,
//       status TEXT DEFAULT 'pending',
//       FOREIGN KEY(requester_id) REFERENCES users(id)
//     )
//   `);

//   // --- SECURITY SUPERVISORS ---
//   await db.run(`
//     CREATE TABLE IF NOT EXISTS security_supervisors (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       name TEXT,
//       username TEXT UNIQUE,
//       password TEXT,
//       client_id INTEGER,
//       site_name TEXT,
//       created_by INTEGER,
//       FOREIGN KEY(client_id) REFERENCES clients(id),
//       FOREIGN KEY(created_by) REFERENCES users(id)
//     )
//   `);

//   return db;
// }

// export async function query(sql, params = []) {
//   const db = await initDB();
//   return await db.all(sql, params);
// }

// export async function run(sql, params = []) {
//   const db = await initDB();
//   const stmt = await db.prepare(sql);
//   await stmt.bind(params);
//   await stmt.run();
//   const insertId = db.lastID;
//   await stmt.finalize();
//   return {insertId};
// }

