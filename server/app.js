require('dotenv').config();

const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const { pool, initializeDatabase } = require('./db');
const postRoutes = require('./routes/posts');
const { getMedia } = postRoutes;

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret || sessionSecret.length < 32) throw new Error('Set SESSION_SECRET to a random string of at least 32 characters in your .env file.');

if (isProduction) app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'ws:', 'wss:'],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
}));
app.use(express.json({ limit: '1mb' }));
app.use(session({
  name: 'auvblog.sid',
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  store: new PgSession({ pool, tableName: 'user_sessions', createTableIfMissing: true, ttl: 60 * 60 * 8 }),
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: 8 * 60 * 60 * 1000,
  },
}));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Wait 15 minutes and try again.' },
});

function rejectCrossSiteMutation(req, res, next) {
  const origin = req.get('Origin');
  if (origin) {
    try {
      if (new URL(origin).host !== req.get('host')) {
        return res.status(403).json({ error: 'Request origin was not accepted.' });
      }
    } catch {
      return res.status(403).json({ error: 'Request origin was not accepted.' });
    }
  }
  next();
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.post('/api/admin/login', loginLimiter, rejectCrossSiteMutation, async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const { rows } = await pool.query('SELECT id, username, password_hash FROM admins WHERE username = $1 LIMIT 1', [username]);
    const admin = rows[0];
    if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
      return res.status(401).json({ error: 'That username and password did not match.' });
    }
    req.session.regenerate((error) => {
      if (error) return next(error);
      req.session.adminId = String(admin.id);
      req.session.username = admin.username;
      req.session.csrfToken = crypto.randomBytes(32).toString('hex');
      req.session.save((saveError) => {
        if (saveError) return next(saveError);
        res.json({ admin: { username: admin.username }, csrfToken: req.session.csrfToken });
      });
    });
  } catch (error) { next(error); }
});

app.get('/api/admin/session', (req, res) => {
  if (!req.session.adminId) return res.json({ admin: null });
  res.set('Cache-Control', 'no-store').set('X-Robots-Tag', 'noindex, nofollow').json({
    admin: { username: req.session.username },
    csrfToken: req.session.csrfToken,
  });
});

app.post('/api/admin/logout', rejectCrossSiteMutation, (req, res) => {
  const expected = req.session.csrfToken || '';
  const supplied = req.get('X-CSRF-Token') || '';
  if (!expected || expected.length !== supplied.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) {
    return res.status(403).json({ error: 'Security token expired. Refresh the page and try again.' });
  }
  req.session.destroy((error) => {
    if (error) return res.status(500).json({ error: 'Could not sign out.' });
    res.clearCookie('auvblog.sid', { httpOnly: true, secure: isProduction, sameSite: 'strict' });
    res.json({ ok: true });
  });
});

app.use('/api/posts', postRoutes);
app.get('/api/media/:id', getMedia);

if (process.env.VERCEL !== '1') {
  const clientDist = path.resolve(__dirname, '../client/dist');
  app.use(express.static(clientDist, { index: false, maxAge: isProduction ? '1h' : 0 }));
  app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    if (req.path.startsWith('/admin')) {
      res.set('Cache-Control', 'no-store');
      res.set('X-Robots-Tag', 'noindex, nofollow');
    } else {
      res.set('Cache-Control', 'no-cache');
    }
    res.sendFile(path.join(clientDist, 'index.html'), (error) => {
      if (error) next(error);
    });
  });
} else {
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
}

app.use((error, _req, res, _next) => {
  if (error?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'That file is too large. The upload limit is 4 MB.' });
  }
  if (error?.name === 'MulterError') {
    return res.status(400).json({ error: 'There was a problem with that file upload.' });
  }
  if (error?.code === '23505') {
    return res.status(409).json({ error: 'An article with this URL already exists.' });
  }
  console.error(error);
  res.status(error.status || 500).json({ error: error.message || 'Something went wrong.' });
});

module.exports = { app, initializeDatabase };
