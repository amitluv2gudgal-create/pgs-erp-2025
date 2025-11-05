import express from 'express';
import cors from 'cors';
import session from 'express-session';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
dotenv.config();

import authRoutes from './controllers/auth.js';
import clientRoutes from './controllers/clients.js';
import employeeRoutes from './controllers/employees.js';
// ... other imports

const app = express();
const FRONTEND_ORIGIN = 'https://pgs-erp-2025-1.onrender.com';
app.set('trust proxy', 1); // required on Render for secure cookies

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (origin === FRONTEND_ORIGIN) return cb(null, true);
    return cb(new Error('CORS not allowed'), false);
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

const { SESSION_SECRET, NODE_ENV } = process.env;
if (!SESSION_SECRET) {
  console.error('Missing SESSION_SECRET env var');
  process.exit(1);
}

app.use(session({
  name: 'pgs_sid', // must match controllers/auth.js clearCookie name
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: NODE_ENV === 'production',
    sameSite: 'none', // required for cross-site cookies
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

// Mount auth routes BEFORE protecting the rest of /api endpoints
app.use('/api/auth', authRoutes);

// Protect remaining /api routes
const requireAuth = (req, res, next) => {
  // allow current-user and login/logout on auth router because auth router mounted above
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};
app.use('/api', requireAuth);

// mount protected API routes
app.use('/api/clients', clientRoutes);
app.use('/api/employees', employeeRoutes);
// ... other protected routers

// fallback page routes
app.get('/', (req,res) => res.redirect('/login.html'));
