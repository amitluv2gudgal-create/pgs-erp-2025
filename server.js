// server.js
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import SQLiteStoreFactory from 'connect-sqlite3';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';

// import the functions we implemented in db.js
import { dropLegacyClientAddressColumn, ensureRequestsApproverColumn, ensureClientExtraFields, initDB, dbModule, DB_PATH } from './db.js';

// Route modules (pure routers — must NOT touch DB at import time)
import authRoutes from './controllers/auth.js';
import clientRoutes from './controllers/clients.js';
import employeeRoutes from './controllers/employees.js';
import attendanceRoutes from './controllers/attendances.js';
import deductionRoutes from './controllers/deductions.js';
import invoiceRoutes from './controllers/invoices.js';
import salaryRoutes from './controllers/salaries.js';
import requestRoutes from './controllers/requests.js';
import securitySupervisorRoutes from './controllers/security_supervisors.js';
import deductionRoutes from './controllers/deductions.js';
dotenv.config();

const app = express();
app.use(cors()); // allow all origins; restrict in production as needed
app.use(express.json());
// Behind Render's proxy, this is REQUIRED for secure cookies to be set
app.set('trust proxy', 1);

const SQLiteStore = SQLiteStoreFactory(session);

const { SESSION_SECRET, NODE_ENV } = process.env;
const PORT = process.env.PORT || 3000;

if (!SESSION_SECRET) {
  console.error('Missing SESSION_SECRET');
  process.exit(1);
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

let sessionStore = null;

async function initSessionStore() {
  try {
    // dynamic import - won't crash at startup if package missing
    const mod = await import('connect-sqlite3');
    const SQLiteStoreFactory = mod.default ?? mod;
    const SQLiteStore = SQLiteStoreFactory(session);
    sessionStore = new SQLiteStore({ db: 'sessions.sqlite', dir: './data', concurrentDB: true });
    console.log('Using connect-sqlite3 session store.');
  } catch (err) {
    // package not installed or failed to load
    console.warn('connect-sqlite3 not available, falling back to MemoryStore (not for production).', err && err.message);
    sessionStore = null; // MemoryStore used by express-session if store not provided
  }
}

app.use(session({
  store: new SQLiteStore({
    db: 'sessions.sqlite',   // file name for sessions DB
    dir: './data',           // directory (ensure this exists or use './')
    concurrentDB: true       // safer with multiple connections
    // other options: table: 'sessions'
  }),
  secret: process.env.SESSION_SECRET || 'f1485d3772873244db48c4248f74a0aebeaaa27b94b0a2d9de2a32f349d416cf',
  resave: false,             // recommended: false
  saveUninitialized: false,  // recommended: false
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 1 day
    secure: true,                // require HTTPS (Render serves HTTPS)
    sameSite: 'lax'              // adjust as required
  }
}));

// Only protect /api; allow /api/auth/login and /api/auth/current-user
const requireAuth = (req, res, next) => {
  if (req.path === '/auth/login' || req.path === '/auth/current-user') return next();
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
};

async function bootstrap() {
  try {
    // 1) Initialize DB (creates tables + seeds admin)
    await initDB();
    console.log('[db] Ready at:', DB_PATH);

    // run migrations / extra steps (they are idempotent)
    await ensureRequestsApproverColumn().catch(err => console.error('ensureRequestsApproverColumn failed:', err));
    await ensureClientExtraFields().catch(err => console.error('ensureClientExtraFields failed:', err));
    await dropLegacyClientAddressColumn().catch(err => console.error('dropLegacyClientAddressColumn failed:', err));

    // 2) Register middleware AFTER DB is ready
    app.use('/api', requireAuth);

    // 3) Register routes (routers must not run queries at import time)
    app.use('/api/auth', authRoutes);
    app.use('/api/clients', clientRoutes);
    app.use('/api/employees', employeeRoutes);
    app.use('/api/attendances', attendanceRoutes);
    app.use('/api/deductions', deductionRoutes);
    app.use('/api/invoices', invoiceRoutes);
    app.use('/api/salaries', salaryRoutes);
    app.use('/api/requests', requestRoutes);
    app.use('/api/security-supervisors', securitySupervisorRoutes);

    // 4) Basic pages
    app.get('/', (req, res) => res.redirect('/login.html'));
    app.get('/favicon.ico', (req, res) => res.status(204).end());

    // start server
    app.listen(PORT, () => {
      console.log(`PGS-ERP running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Fatal startup error:', err);
    process.exit(1);
  }
}

bootstrap();
