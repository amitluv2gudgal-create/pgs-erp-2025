// server.js (patched)
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import SQLiteStoreFactory from 'connect-sqlite3';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';

// DB helpers and migrations (as you had)
import {
  dropLegacyClientAddressColumn,
  ensureRequestsApproverColumn,
  ensureClientExtraFields,
  initDB,
  dbModule,
  DB_PATH
} from './db.js';

// Routers
import authRoutes from './controllers/auth.js';
import clientRoutes from './controllers/clients.js';
import employeeRoutes from './controllers/employees.js';
import attendanceRoutes from './controllers/attendances.js';
import deductionRoutes from './controllers/deductions.js'; // single import for deductions
import invoiceRoutes from './controllers/invoices.js';
import salaryRoutes from './controllers/salaries.js';
import requestRoutes from './controllers/requests.js';
import securitySupervisorRoutes from './controllers/security_supervisors.js';

dotenv.config();

const app = express();
app.use(cors()); // adjust origin in production if needed
app.use(express.json());
app.set('trust proxy', 1); // required on Render for secure cookies

// parse bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Session store (sqlite)
const SQLiteStore = SQLiteStoreFactory(session);

// ensure data directory exists when running locally; Render will create files under project
// Use './data' directory for session DB (ensure it exists in repo or created at runtime)
const sessionStore = new SQLiteStore({
  db: 'sessions.sqlite',
  dir: './data',
  concurrentDB: true
});

const { SESSION_SECRET, NODE_ENV } = process.env;
const PORT = process.env.PORT || 3000;

if (!SESSION_SECRET) {
  console.error('Missing SESSION_SECRET environment variable — set it on Render or locally');
  process.exit(1);
}

app.use(session({
  store: sessionStore,
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    secure: NODE_ENV === 'production', // true in Render (HTTPS)
    sameSite: 'lax'
  }
}));

// Only protect /api; allow /api/auth/login and /api/auth/current-user
const requireAuth = (req, res, next) => {
  if (req.path === '/auth/login' || req.path === '/auth/current-user') return next();
  if (!req.session?.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
};

async function bootstrap() {
  try {
    // Initialize DB and run idempotent migrations
    await initDB();
    console.log('[db] Ready at:', DB_PATH);

    await ensureRequestsApproverColumn().catch(err => console.error('ensureRequestsApproverColumn failed:', err));
    await ensureClientExtraFields().catch(err => console.error('ensureClientExtraFields failed:', err));
    await dropLegacyClientAddressColumn().catch(err => console.error('dropLegacyClientAddressColumn failed:', err));

    // Register middleware and routes AFTER DB ready
    app.use('/api', requireAuth);

    // mount routers (one registration per route)
    app.use('/api/auth', authRoutes);
    app.use('/api/clients', clientRoutes);
    app.use('/api/employees', employeeRoutes);
    app.use('/api/attendances', attendanceRoutes);
    app.use('/api/deductions', deductionRoutes);
    app.use('/api/invoices', invoiceRoutes);
    app.use('/api/salaries', salaryRoutes);
    app.use('/api/requests', requestRoutes);
    app.use('/api/security-supervisors', securitySupervisorRoutes);

    // Basic pages
    app.get('/', (req, res) => res.redirect('/login.html'));
    app.get('/favicon.ico', (req, res) => res.status(204).end());

    // start server
    app.listen(PORT, () => {
      console.log(`PGS-ERP running on http://localhost:${PORT} (port ${PORT})`);
    });
  } catch (err) {
    console.error('Fatal startup error:', err);
    process.exit(1);
  }
}

bootstrap();
