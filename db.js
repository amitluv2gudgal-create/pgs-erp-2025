// db.js
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import fs from 'fs';
import path from 'path';

const DB_PATH = process.env.DB_PATH || path.join('./data', 'database.db');

async function openDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });
  return db;
}

async function ensureSchema() {
  const db = await openDb();
  try {
    // clients table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        client_unique_number TEXT,
        address_line1 TEXT,
        address_line2 TEXT,
        state TEXT,
        district TEXT,
        telephone TEXT,
        email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // users table for simple auth (for dev). Passwords stored in plain text here for simplicity.
    // Change to hashed passwords for production (bcrypt).
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // seed a default user (accountant / rohit123) only if not exists
    const existing = await db.get(`SELECT id FROM users WHERE username = ?`, 'accountant');
    if (!existing) {
      await db.run(`INSERT INTO users (username, password, role) VALUES (?, ?, ?)`, 'accountant', 'rohit123', 'accountant');
      console.log('Seeded default user: accountant / rohit123 (dev only)');
    }
  } finally {
    await db.close();
  }
}

// data functions
export async function getClients() {
  const db = await openDb();
  try {
    const rows = await db.all(`
      SELECT id, name, client_unique_number, address_line1, address_line2, state, district, telephone, email, created_at
      FROM clients
      ORDER BY id DESC
    `);
    return rows;
  } finally {
    await db.close();
  }
}

export async function insertClient(payload = {}) {
  const db = await openDb();
  try {
    const stmt = await db.run(
      `INSERT INTO clients (name, client_unique_number, address_line1, address_line2, state, district, telephone, email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      payload.name || null,
      payload.client_unique_number || null,
      payload.address_line1 || null,
      payload.address_line2 || null,
      payload.state || null,
      payload.district || null,
      payload.telephone || null,
      payload.email || null
    );
    return { id: stmt.lastID ?? null };
  } finally {
    await db.close();
  }
}

export async function getUserByUsername(username) {
  const db = await openDb();
  try {
    const row = await db.get(`SELECT id, username, password, role FROM users WHERE username = ?`, username);
    return row || null;
  } finally {
    await db.close();
  }
}

export async function createUser(username, password, role = 'accountant') {
  const db = await openDb();
  try {
    const stmt = await db.run(`INSERT INTO users (username, password, role) VALUES (?, ?, ?)`, username, password, role);
    return { id: stmt.lastID ?? null };
  } finally {
    await db.close();
  }
}

// ensure schema is present at module load
await ensureSchema();

export default {
  openDb,
  getClients,
  insertClient,
  getUserByUsername,
  createUser,
  DB_PATH
};
