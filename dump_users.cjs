// dump_users.cjs  (run with: node dump_users.cjs)
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbfile = path.join(__dirname, 'database.db'); // adjust if your file name differs

const db = new sqlite3.Database(dbfile, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Open DB error:', err.message);
    process.exit(1);
  }
});

db.all("SELECT id, username, role, password, password_hash FROM users LIMIT 200", (err, rows) => {
  if (err) {
    console.error('SQL error:', err.message);
  } else {
    console.log('Users table rows:');
    console.table(rows);
  }
  db.close();
});
