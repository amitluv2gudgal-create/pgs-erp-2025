// manage_users.cjs
// 1) Prints schema and sample rows
// 2) If 'admin' user missing, inserts admin using best-fit columns.
// Run: node manage_users.cjs

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbfile = path.join(__dirname, 'database.db'); // adjust if your DB filename differs

const db = new sqlite3.Database(dbfile, sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error('Open DB error:', err.message);
    process.exit(1);
  }
});

function findColumn(cols, names) {
  const lowered = cols.map(c => c.name.toLowerCase());
  for (const name of names) {
    const idx = lowered.indexOf(name.toLowerCase());
    if (idx !== -1) return cols[idx].name;
  }
  return null;
}

db.serialize(() => {
  console.log('=== PRAGMA table_info(users) ===');
  db.all("PRAGMA table_info('users')", (err, cols) => {
    if (err) {
      console.error('PRAGMA error (maybe table not named users?):', err.message);
      // Try to list all tables to help diagnose
      db.all("SELECT name, type FROM sqlite_master WHERE type IN ('table','view')", (e2, tables) => {
        if (e2) {
          console.error('Also failed to list sqlite_master:', e2.message);
        } else {
          console.log('Detected tables/views:');
          console.table(tables);
        }
        db.close();
      });
      return;
    }

    if (!cols || cols.length === 0) {
      console.log('No columns returned for users table. Table may not exist.');
      db.all("SELECT name, type FROM sqlite_master WHERE type IN ('table','view')", (e2, tables) => {
        if (e2) console.error('sqlite_master error:', e2.message);
        else console.table(tables);
        db.close();
      });
      return;
    }

    console.table(cols);

    console.log('\n=== First 200 rows from users (if any) ===');
    db.all("SELECT * FROM users LIMIT 200", (err2, rows) => {
      if (err2) {
        console.error('SELECT * FROM users error:', err2.message);
        db.close();
        return;
      }
      console.table(rows || []);

      // Now check existence of admin
      const usernameCol = findColumn(cols, ['username', 'user', 'uname', 'login']);
      if (!usernameCol) {
        console.error('No username-like column detected in users table. Cannot proceed with auto-insert.');
        db.close();
        return;
      }

      // Check if admin exists
      const q = `SELECT * FROM users WHERE ${usernameCol} = ? LIMIT 1`;
      db.get(q, ['admin'], (err3, adminRow) => {
        if (err3) {
          console.error('Error checking admin existence:', err3.message);
          db.close();
          return;
        }

        if (adminRow) {
          console.log('Admin user already exists. Row:');
          console.dir(adminRow);
          db.close();
          return;
        }

        console.log('Admin user NOT found. Preparing to insert a debug admin (username: admin, password: rahul123).');

        // pick password-like and role-like columns
        const passwordCol = findColumn(cols, ['password', 'pass', 'pwd', 'userpass']);
        const roleCol = findColumn(cols, ['role', 'user_role', 'rolename', 'type']);

        // Build insert statement dynamically
        const insertCols = [usernameCol];
        const insertVals = ['admin'];

        if (passwordCol) {
          insertCols.push(passwordCol);
          insertVals.push('rahul123'); // plaintext for debug only
        }

        if (roleCol) {
          insertCols.push(roleCol);
          insertVals.push('admin');
        }

        // Compose SQL
        const placeholders = insertCols.map(() => '?').join(', ');
        const sql = `INSERT INTO users (${insertCols.join(', ')}) VALUES (${placeholders})`;

        console.log('Running insert SQL:', sql);
        console.log('With values:', insertVals);

        db.run(sql, insertVals, function(err4) {
          if (err4) {
            console.error('Insert error:', err4.message);
            db.close();
            return;
          }
          console.log('Inserted admin id =', this.lastID);
          // show the inserted row
          db.get(q, ['admin'], (err5, newRow) => {
            if (err5) console.error('Error fetching new admin row:', err5.message);
            else console.log('Inserted admin row:', newRow);
            db.close();
          });
        });
      });
    });
  });
});
