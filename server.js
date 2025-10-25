// server.js — Neon Postgres version (no initDB)
import cors from 'cors';
import express from 'express';
import session from 'express-session';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import authRoutes from './controllers/auth.js';
import clientRoutes from './controllers/clients.js';
import employeeRoutes from './controllers/employees.js';
import attendanceRoutes from './controllers/attendances.js';
import deductionRoutes from './controllers/deductions.js';
import invoiceRoutes from './controllers/invoices.js';
import salaryRoutes from './controllers/salaries.js';
import requestRoutes from './controllers/requests.js';
import securitySupervisorRoutes from './controllers/security_supervisors.js';
import { forbidSupervisorGet } from './middleware/forbidSupervisorGet.js';
import { DB_URL } from './db.js';
import connectPgSimple from 'connect-pg-simple';
import pg from 'pg';


dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET;
const ORIGIN = process.env.FRONTEND_ORIGIN || '';
const isProd = process.env.NODE_ENV === 'production';

// ---- Boot logs ----
try {
  console.log('[db] Using Postgres URL host:', DB_URL ? new URL(DB_URL).host : '(unset)');
} catch {
  console.log('[db] Using Postgres URL:', DB_URL);
}
if (!SESSION_SECRET) {
  console.error('Error: SESSION_SECRET is not defined in environment variables.');
  process.exit(1);
}

app.get('/api/debug/db-info', (_req, res) => {
  try {
    return res.json({ host: DB_URL ? new URL(DB_URL).host : null });
  } catch {
    return res.json({ url: DB_URL || null });
  }
});

// ---------- Core config ----------
if (ORIGIN) {
  app.use(cors({
    origin: ORIGIN,
    credentials: true
  }));
}

// Trust Render / reverse proxy so secure cookies work correctly in prod
app.set('trust proxy', 1);

// Static + parsers
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Sessions (MemoryStore is OK for single-instance demo; consider connect-pg-simple for prod)
const PgSession = connectPgSimple(session);
const pgPool = new pg.Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(session({
  store: new PgSession({
    pool: pgPool,
    tableName: 'session'   // will auto-create if missing
  }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 8,   // 8 hours
    secure: isProd,               // HTTPS-only in production
    sameSite: ORIGIN ? 'none' : 'lax'
  }
}));


console.log('[boot] NODE_ENV:', process.env.NODE_ENV || '(unset)');
console.log('[boot] cookie.secure =', isProd);

// ---------- Routes ----------

// Public auth routes
app.use('/api/auth', authRoutes);

// Require auth for the rest of /api
const requireAuth = (req, res, next) => {
  // Allow hitting /api/auth/* without a session
  if (req.path.startsWith('/auth/')) return next();
  if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
};
app.use('/api', requireAuth);

// Endpoint-specific GET restrictions for supervisors (after auth)
app.use('/api/clients', forbidSupervisorGet);
app.use('/api/employees', forbidSupervisorGet);
app.use('/api/attendances', forbidSupervisorGet);
app.use('/api/invoices', forbidSupervisorGet);
app.use('/api/salaries', forbidSupervisorGet);
app.use('/api/deductions', forbidSupervisorGet);

// Session logger (optional)
app.use((req, _res, next) => {
  console.log('[session]', req.sessionID, req.session?.user || 'no-user');
  next();
});

// Protected API routes
app.use('/api/clients', clientRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendances', attendanceRoutes);
app.use('/api/deductions', deductionRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/salaries', salaryRoutes);              // ✅ salaries route included
app.use('/api/requests', requestRoutes);
app.use('/api/security-supervisors', securitySupervisorRoutes);

// Root → login
app.get('/', (req, res) => res.redirect('/login.html'));
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
