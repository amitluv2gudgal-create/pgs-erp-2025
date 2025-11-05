// server.js
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { initDB, DB_PATH } from './db.js';

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

dotenv.config();

const app = express();

// IMPORTANT: set this to your frontend origin (exact, no trailing slash)
const FRONTEND_ORIGIN = 'https://pgs-erp-2025-1.onrender.com';

// CORS: allow credentials and exact origin (do NOT use origin: '*')
app.use(cors({
  origin: (origin, cb) => {
    // allow non-browser (curl) requests with no origin
    if (!origin) return cb(null, true);
    if (origin === FRONTEND_ORIGIN) return cb(null, true);
    return cb(new Error('CORS not allowed'), false);
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

// Behind Render's proxy, this is REQUIRED for secure cookies to be set
app.set('trust proxy', 1);

const { SESSION_SECRET, NODE_ENV } = process.env;
const PORT = process.env.PORT || 3000;

if (!SESSION_SECRET) {
  console.error('Missing SESSION_SECRET');
  process.exit(1);
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Session cookie must allow cross-site (frontend -> backend on different origin)
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'none',                    // important for cross-site cookies
    secure: NODE_ENV === 'production',   // true on Render (HTTPS)
    maxAge: 7 * 24 * 60 * 60 * 1000      // 7 days
  }
}));

// Only protect /api; allow unauthenticated access to login and current-user endpoints
const requireAuth = (req, res, next) => {
  // when mounted at /api, req.path will be like '/auth/login' or '/auth/current-user'
  if (req.path === '/auth/login' || req.path === '/auth/current-user') return next();
  if (!req.session || !req.session.user) {
    // Return JSON 401 for API callers (do not redirect)
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

async function bootstrap() {
  // 1) Initialize DB (creates tables + seeds admin)
  await initDB();
  console.log('[db] Ready at:', DB_PATH);

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

  app.listen(PORT, () => {
    console.log('Server running on port', PORT);
  });
}

bootstrap().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
