// server.js
import express from 'express';
import session from 'express-session';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { ensureClientExtraFields } from './db.js';
import { dropLegacyClientAddressColumn } from './db.js';
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

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
   httpOnly: true,                 // not readable by JS
   sameSite: 'lax',                // works across normal GET navigations
   secure: process.env.NODE_ENV === 'production', // set on HTTPS
   maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
 }
}));


// Only protect /api; allow /api/auth/login and /api/auth/current-user
const requireAuth = (req, res, next) => {
  if (req.path === '/auth/login' || req.path === '/auth/current-user') return next();
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
};

async function bootstrap() {
  // 1) Initialize DB (creates tables + seeds admin)
  await initDB();
  console.log('[db] Ready at:', DB_PATH);

  ensureClientExtraFields().catch(err => console.error('Client fields migration failed:', err));
  await dropLegacyClientAddressColumn();

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
