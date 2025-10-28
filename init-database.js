// init-database.js
import { initDB } from './db.js';

async function initializeDatabase() {
  const db = await initDB();
  console.log('Database initialized successfully');
  db.close();
}

initializeDatabase().catch(err => console.error('Initialization error:', err));