// server.js
import express from 'express';
import session from 'express-session';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
// import { initDB } from './db.js';
import { initDB, DB_PATH } from './db.js';  // import DB_PATH
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

const app = express();
dotenv.config();

const { SESSION_SECRET, PORT: envPort, NODE_ENV } = process.env;
if (!SESSION_SECRET) {
  console.error('Error: SESSION_SECRET is not defined in env');
  process.exit(1);
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: NODE_ENV === 'production' }  // secure in prod
}));

// Initialize DB before routes
(async () => {
  try {
    await initDB();
    console.log('Database initialized successfully');
    console.log('[db] Using:', DB_PATH);
  } catch (err) {
    console.error('Database initialization error:', err);
    process.exit(1);
  }
})();

// --- Auth gate registered BEFORE protected routes ---
const requireAuth = (req, res, next) => {
  if (req.path === '/auth/login' || req.path === '/auth/current-user') return next();
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
};
app.use('/api', requireAuth);

// Routes (unchanged)
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendances', attendanceRoutes);
app.use('/api/deductions', deductionRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/salaries', salaryRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/security-supervisors', securitySupervisorRoutes);
// ... your forbidSupervisorGet lines

app.get('/', (req, res) => res.redirect('/login.html'));
app.get('/favicon.ico', (req, res) => res.status(204).end());

const PORT = envPort || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));