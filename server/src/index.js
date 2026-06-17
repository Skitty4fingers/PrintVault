// PrintVault server entry point.
import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import SqliteStoreFactory from 'better-sqlite3-session-store';

import config from './config.js';
import db, { ensureAdminUser } from './db.js';
import authRoutes from './routes/auth.js';
import fileRoutes from './routes/files.js';
import collectionRoutes from './routes/collections.js';
import shareAdminRoutes from './routes/shares.js';
import sharePublicRoutes from './routes/share.js';
import metaRoutes from './routes/meta.js';

ensureAdminUser();

const app = express();
app.set('trust proxy', 1); // correct client IP behind Tailscale / reverse proxies

// Security headers. CSP is disabled because the SPA + Three.js workers are
// served from the same origin on a private network; other protections stay on.
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-origin' } }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const SqliteStore = SqliteStoreFactory(session);
app.use(
  session({
    store: new SqliteStore({
      client: db,
      expired: { clear: true, intervalMs: 15 * 60 * 1000 },
    }),
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false, // served over http on a private Tailscale network
      maxAge: 1000 * 60 * 60 * 24 * 14, // 14 days
    },
  })
);

// ---- API routes ------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/shares', shareAdminRoutes);
app.use('/api/share', sharePublicRoutes);
app.use('/api', metaRoutes);

// ---- Production: serve the built client + SPA fallback ---------------------
if (fs.existsSync(config.clientDist)) {
  app.use(express.static(config.clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(config.clientDist, 'index.html'));
  });
} else {
  app.get('/', (_req, res) =>
    res.send('PrintVault API is running. Build the client (npm run build) or use the dev server on :5173.')
  );
}

// ---- Error handling --------------------------------------------------------
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: `File too large (max ${config.maxUploadMb} MB)` });
    }
    return res.status(400).json({ error: err.message });
  }
  console.error('[PrintVault] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(config.port, config.host, () => {
  console.log(`[PrintVault] Listening on http://${config.host}:${config.port}  (env: ${config.env})`);
  console.log(`[PrintVault] Storage: ${config.storagePath}`);
});
