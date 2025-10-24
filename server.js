// server.js
import express from 'express';
import session from 'express-session';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { initDB } from './db.js';
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

dotenv.config();

const app = express();

// ---------- Core config ----------
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  console.error('Error: SESSION_SECRET is not defined in environment variables.');
  process.exit(1);
}

// Trust Render / reverse proxy so secure cookies work correctly in prod
app.set('trust proxy', 1);

// Static + parsers
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Sessions
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      // In production (Render), cookies are secure over HTTPS.
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    },
  })
);

// ---------- DB init BEFORE routes ----------
(async () => {
  try {
    await initDB();
    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Database initialization error:', err);
    process.exit(1);
  }

  // ---------- Routes ----------
  // Public auth routes
  app.use('/api/auth', authRoutes);

  // Require auth for the rest of /api
  const requireAuth = (req, res, next) => {
    // Allow login-related endpoints
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

  // Protected API routes
  app.use('/api/clients', clientRoutes);
  app.use('/api/employees', employeeRoutes);
  app.use('/api/attendances', attendanceRoutes);
  app.use('/api/deductions', deductionRoutes);
  app.use('/api/invoices', invoiceRoutes);
  app.use('/api/salaries', salaryRoutes);
  app.use('/api/requests', requestRoutes);
  app.use('/api/security-supervisors', securitySupervisorRoutes);

  // Root → login
  app.get('/', (req, res) => res.redirect('/login.html'));
  app.get('/favicon.ico', (req, res) => res.status(204).end());

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
})();
