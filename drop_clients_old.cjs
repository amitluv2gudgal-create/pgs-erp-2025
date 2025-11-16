// drop_clients_old.cjs
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.join(__dirname, 'database.db'));

db.serialize(() => {
  console.log('Dropping clients_old if exists. This action is irreversible.');
  db.run('DROP TABLE IF EXISTS clients_old', function(err) {
    if (err) console.error('Error dropping clients_old:', err.message);
    else console.log('clients_old dropped (if it existed).');
    db.close();
  });
});
