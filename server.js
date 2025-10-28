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

const app = express();

// Load environment variables
dotenv.config();
const { SESSION_SECRET, PORT: envPort } = process.env;
if (!SESSION_SECRET) {
  console.error('Error: SESSION_SECRET is not defined in .env');
  process.exit(1);
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Session middleware
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true if using HTTPS
}));

// Initialize database (await to ensure completion)
(async () => {
  try {
    await initDB();
    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Database initialization error:', err);
    process.exit(1);
  }
})();

// Routes
app.use('/api/auth', authRoutes); // includes: /login, /logout, /current-user, /change-password, /admin/reset-password
app.use('/api/clients', clientRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendances', attendanceRoutes);
app.use('/api/deductions', deductionRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/salaries', salaryRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/security-supervisors', securitySupervisorRoutes);
app.use('/api/clients', forbidSupervisorGet);
app.use('/api/employees', forbidSupervisorGet);
app.use('/api/attendances', forbidSupervisorGet);
app.use('/api/invoices', forbidSupervisorGet);
app.use('/api/salaries', forbidSupervisorGet);
app.use('/api/deductions', forbidSupervisorGet);

// Authentication middleware (applied to all /api routes except /api/auth)
const requireAuth = (req, res, next) => {
  if (req.path === '/auth/login' || req.path === '/auth/current-user') {
    return next(); // Allow login and current-user routes without authentication
  }
  if (!req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};
app.use('/api', requireAuth);

// Redirect root to login
app.get('/', (req, res) => res.redirect('/login.html'));

app.get('/favicon.ico', (req, res) => res.status(204).end());

const PORT = envPort || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
