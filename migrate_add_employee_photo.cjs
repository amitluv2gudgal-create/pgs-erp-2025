// migrate_add_employee_photo.cjs
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbfile = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbfile);

db.serialize(() => {
  console.log('Adding photo column to employees (if not exists).');
  db.get("PRAGMA table_info(employees);", (err) => {
    // We'll just attempt ALTER TABLE ADD COLUMN; if it exists, error ignored
    db.run(`ALTER TABLE employees ADD COLUMN photo TEXT`, function(err2) {
      if (err2) {
        if (err2.message && err2.message.includes('duplicate column name')) {
          console.log('photo column already exists.');
        } else {
          console.log('Could not add column (it may already exist):', err2.message);
        }
      } else {
        console.log('photo column added.');
      }
      db.close();
    });
  });
});