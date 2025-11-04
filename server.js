// server.js
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import SQLiteStoreFactory from 'connect-sqlite3';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- CORS config (allow your dev origin + deployed origin) ---
const allowedOrigins = [
  'http://localhost:3000',                     // frontend dev (change if different)
  'http://localhost:8080',                     // alternate local front-end
  'https://pgs-erp-2025-1.onrender.com'        // deployed front-end (change if different)
];

// allow null origin (curl, server-to-server)
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('CORS not allowed'), false);
  },
  credentials: true
}));

// --- sessions ---
const SQLiteStore = SQLiteStoreFactory(session);
const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = process.env.PORT || 8080;
const SESSION_SECRET = process.env.SESSION_SECRET || 'please-change-this-secret';

app.use(session({
  store: new SQLiteStore({ db: 'sessions.sqlite', dir: './data', concurrentDB: true }),
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    secure: NODE_ENV === 'production',                       // secure in production (HTTPS)
    sameSite: NODE_ENV === 'production' ? 'none' : 'lax'    // none so cross-site cookies work in prod
  }
}));

// serve static front-end
app.use(express.static(path.join(__dirname, 'public')));

// small health route
app.get('/health', (req, res) => res.json({ ok: true }));

// import controllers (note: use named import for clients)
import authRouter from './controllers/auth.js';
import { getClients, createClient } from './controllers/clients.js';

// mount auth router under /api/auth
app.use('/api/auth', authRouter);

// requireAuth middleware for /api routes except /api/auth
function requireAuth(req, res, next) {
  // allow login routes
  if (req.path.startsWith('/auth')) return next();

  // allow public health or static assets
  if (req.path === '/health') return next();

  // all /api requests should be authenticated
  if (req.session && req.session.user) return next();

  return res.status(401).json({ error: 'Unauthorized' });
}
app.use('/api', requireAuth);

// client endpoints
// GET /api/clients
app.get('/api/clients', getClients);
// POST /api/clients
app.post('/api/clients', createClient);

// optional: current-user helper (for debug)
app.get('/api/auth/current-user', (req, res) => {
  res.json({ user: req.session?.user ?? null });
});

// global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err && err.stack ? err.stack : err);
  if (!res.headersSent) res.status(500).json({ error: 'Unhandled server error', message: err?.message });
  else next(err);
});

process.on('unhandledRejection', (r) => console.error('unhandledRejection', r));
process.on('uncaughtException', (err) => console.error('uncaughtException', err && err.stack ? err.stack : err));

// start server
app.listen(PORT, () => console.log(`PGS-ERP running on port ${PORT} (NODE_ENV=${NODE_ENV})`));
