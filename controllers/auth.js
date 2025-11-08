// server.js (fixed login 401)
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import SQLiteStoreFactory from 'connect-sqlite3';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';

import {
  dropLegacyClientAddressColumn,
  ensureRequestsApproverColumn,
  ensureClientExtraFields,
  initDB,
  DB_PATH
} from './db.js';

import authRoutes from './controllers/auth.js';
import clientsCtrl from './controllers/clients.js';
import employeeRoutes from './controllers/employees.js';
import attendanceRoutes from './controllers/attendances.js';
import deductionRoutes from './controllers/deductions.js';
import invoiceRoutes from './controllers/invoices.js';
import salaryRoutes from './controllers/salaries.js';
import requestRoutes from './controllers/requests.js';
import securitySupervisorRoutes from './controllers/security_supervisors.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const { SESSION_SECRET, NODE_ENV } = process.env;

if (!SESSION_SECRET) {
  console.error('Missing SESSION_SECRET environment variable — set it on Render or locally');
  process.exit(1);
}

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('trust proxy', 1);

// Sessions (SQLite)
const SQLiteStore = SQLiteStoreFactory(session);
const sessionStore = new SQLiteStore({
  db: 'sessions.sqlite',
  dir: './data',
  concurrentDB: true
});
app.use(session({
  store: sessionStore,
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    secure: NODE_ENV === 'production',
    sameSite: 'lax'
  }
}));

// ---- Mount AUTH routes FIRST (so /api/auth/login is accessible) ----
app.use('/api/auth', authRoutes);

// Then protect all other /api routes
const requireAuth = (req, res, next) => {
  if (req.session?.user) return next();
  return res.status(401).json({ error: 'Unauthorized' });
};
app.use('/api', requireAuth);

// ---- Mount all protected routers ----
app.use('/api/employees', employeeRoutes);
app.use('/api/attendances', attendanceRoutes);
app.use('/api/deductions', deductionRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/salaries', salaryRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/security-supervisors', securitySupervisorRoutes);

// direct client CRUD endpoints
app.get('/api/clients', clientsCtrl.listClients);
app.get('/api/clients/:id', clientsCtrl.getClient);
app.post('/api/clients', clientsCtrl.createClient);
app.put('/api/clients/:id', clientsCtrl.updateClient);
app.delete('/api/clients/:id', clientsCtrl.deleteClient);
app.get('/api/clients/:id/categories', clientsCtrl.listClientCategories);
app.post('/api/clients/:id/categories', clientsCtrl.addClientCategory);
app.delete('/api/clients/:id/categories/:catId', clientsCtrl.removeClientCategory);

// Basic pages
app.get('/', (req, res) => res.redirect('/login.html'));
app.get('/favicon.ico', (_, res) => res.status(204).end());

// ---- Initialize DB then start server ----
(async () => {
  try {
    await initDB();
    await ensureRequestsApproverColumn();
    await ensureClientExtraFields();
    await dropLegacyClientAddressColumn();

    app.listen(PORT, () => {
      console.log(`✅ PGS-ERP running on port ${PORT} (env: ${NODE_ENV || 'dev'})`);
      console.log('[db] Ready at:', DB_PATH);
    });
  } catch (err) {
    console.error('Fatal startup error:', err);
    process.exit(1);
  }
})();
