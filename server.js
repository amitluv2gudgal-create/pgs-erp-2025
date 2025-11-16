// server.js
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import session from 'express-session';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import os from 'node:os';
import { initDB, DB_FILE_PATH } from './db.js';
import multer from 'multer';
import fs from 'fs';

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

const upload = multer({ storage: multer.memoryStorage() });
const app = express();

// If behind a proxy (Render), needed so secure cookies work properly when in production.
app.set('trust proxy', 1);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { SESSION_SECRET, NODE_ENV } = process.env;
const PORT = process.env.PORT || 3000;

if (!SESSION_SECRET) {
  console.error('Missing SESSION_SECRET - set it in .env');
  process.exit(1);
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files (public) early so login page & client JS/CSS are served
app.use(express.static('public'));

// helper
const isLocalHostName = (host) => {
  if (!host) return true;
  const h = host.split(':')[0];
  return ['localhost', '127.0.0.1', '::1'].includes(h);
};

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    // default: allow cookies for localhost & http
    secure: false,
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

// Dynamically adjust secure flag per-request: make secure true only when actually HTTPS & not localhost
app.use((req, res, next) => {
  try {
    const host = req.headers.host || '';
    const local = isLocalHostName(host);
    // if running in production and the incoming request is secure (https) and not localhost, enable secure flag
    if (process.env.NODE_ENV === 'production' && req.secure && !local) {
      req.session.cookie.secure = true;
    } else {
      req.session.cookie.secure = false;
    }
    // useful debug log for cookie behaviour (will be printed on each request)
    // Comment out after debugging if too chatty.
    console.log(`[SESSION DEBUG] host=${host} req.secure=${req.secure} NODE_ENV=${process.env.NODE_ENV} cookie.secure=${req.session.cookie.secure}`);
  } catch (e) {
    console.error('[SESSION DEBUG] error adjusting cookie.secure', e);
  }
  next();
});

// Session middleware - local dev friendly: secure true only in production (HTTPS).
// app.use(session({
//   secret: SESSION_SECRET,
//   resave: false,
//   saveUninitialized: false,
//   cookie: {
//     httpOnly: true,
//     sameSite: 'lax',
//     secure: NODE_ENV === 'production', // false on localhost, true in production with HTTPS
//     maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
//   }
// }));

// Only protect API routes; allow unauthenticated access to login and current-user endpoints.
// Note: this middleware is mounted on '/api' later so req.path will be '/auth/login' etc.
const requireAuth = (req, res, next) => {
  // allow unauthenticated POST /api/auth/login and GET /api/auth/current-user
  if (req.path === '/auth/login' || req.path === '/auth/current-user') return next();
  if (!req.session?.user) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  next();
};

async function bootstrap() {
  // 1) Initialize DB (creates tables + seeds admin if needed)
  await initDB();
  console.log('[db] Ready at:', DB_FILE_PATH);

  // 2) Register middleware AFTER DB is ready
  app.use('/api', requireAuth);

  // 3) Register routes
  app.use('/api/auth', authRoutes);
  app.use('/api/clients', clientRoutes);
  app.use('/api/employees', employeeRoutes);
  app.use('/api/attendances', attendanceRoutes);
  app.use('/api/deductions', deductionRoutes);
  app.use('/api/invoices', invoiceRoutes);
  app.use('/api/salaries', salaryRoutes);
  app.use('/api/requests', requestRoutes);
  app.use('/api/security-supervisors', securitySupervisorRoutes);
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
  // 4) Basic pages
  app.get('/', (req, res) => res.redirect('/login.html'));
  app.get('/favicon.ico', (req, res) => res.status(204).end());

  app.post('/_upload_db', upload.single('dbfile'), async (req, res) => {
  try {
    if (!process.env.ADMIN_UPLOAD_SECRET) return res.status(500).send('Server not configured');
    const secret = req.headers['x-upload-secret'] || req.body.secret;
    if (!secret || secret !== process.env.ADMIN_UPLOAD_SECRET) return res.status(403).send('Forbidden');

    if (!req.file || !req.file.buffer) return res.status(400).send('No file uploaded');
    const dbPath = process.env.DATABASE_FILE || '/var/data/database.db';
    // Backup existing first
    try {
      if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, dbPath + '.bak-' + Date.now());
      }
    } catch (e) { console.warn('backup failed', e); }
    fs.writeFileSync(dbPath, req.file.buffer);
    return res.json({ ok: true, path: dbPath });
  } catch (e) {
    console.error('upload error', e);
    res.status(500).json({ error: e.message });
  }
});

  app.listen(PORT, () => {
    console.log('Server running on port', PORT, 'NODE_ENV=' + (NODE_ENV || 'development'));
  });
}

bootstrap().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
