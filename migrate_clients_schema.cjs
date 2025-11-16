// migrate_clients_schema.cjs
// Run: node migrate_clients_schema.cjs
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbfile = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbfile);

db.serialize(() => {
  console.log('Starting clients schema migration. Backup your DB first.');

  // 1. Create new table with desired columns
  db.run(`
    CREATE TABLE IF NOT EXISTS clients_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      address_line1 TEXT,    -- billed to (old 'address' mapped here)
      address_line2 TEXT,    -- shipped to
      contact_person TEXT,   -- old 'contact' mapped here
      state TEXT,
      district TEXT,
      po_order TEXT,         -- PO Order & Dated combined string
      telephone TEXT,
      email TEXT,
      cgst REAL DEFAULT 0,
      sgst REAL DEFAULT 0,
      igst REAL DEFAULT 0,
      -- keep old categories in separate table client_categories unchanged
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `, function (err) {
    if (err) console.error('Create clients_new error:', err.message);
    else console.log('clients_new created (or exists).');
  });

  // 2. Copy existing data mapping address -> address_line1 and contact -> contact_person
  db.run(`
    INSERT INTO clients_new (id, name, address_line1, contact_person, telephone, email, cgst, sgst)
    SELECT id, name, address, contact, telephone, email, cgst, sgst FROM clients;
  `, function (err) {
    if (err) {
      console.error('Error copying existing clients:', err.message);
    } else {
      console.log('Existing clients copied into clients_new.');
    }
  });

  // 3. Drop old table and rename
  db.run(`ALTER TABLE clients RENAME TO clients_old;`, function (err) {
    if (err) console.error('Rename clients -> clients_old error (maybe already renamed):', err.message);
    else console.log('Old clients renamed to clients_old.');
  });

  db.run(`ALTER TABLE clients_new RENAME TO clients;`, function (err) {
    if (err) console.error('Rename clients_new -> clients error:', err.message);
    else console.log('clients_new renamed to clients.');
  });

  // 4. (Optional) list clients table columns
  db.all(`PRAGMA table_info(clients);`, (err, rows) => {
    if (err) console.error('PRAGMA error:', err.message);
    else {
      console.log('New clients table schema:');
      console.table(rows);
    }
    // Note: do NOT drop clients_old automatically here. Leave it until you verify.
    console.log('Migration finished. Verify data. If OK, you can DROP TABLE clients_old;');
    db.close();
  });
});
