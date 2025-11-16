// show_clients_schema.cjs
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, 'database.db'));

db.serialize(() => {
  db.all("PRAGMA table_info('clients')", (err, cols) => {
    if (err) { console.error('PRAGMA error:', err.message); db.close(); return; }
    console.log('clients schema:'); console.table(cols);
    db.all("SELECT id, name, address_line1, address_line2, contact_person, state, district, po_order, telephone, email, cgst, sgst, igst FROM clients LIMIT 50", (e, rows) => {
      if (e) console.error('Select error:', e.message);
      else console.table(rows);
      db.close();
    });
  });
});
