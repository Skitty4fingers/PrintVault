// Centralized configuration loaded from environment variables.
// Loads the repo-root .env in development; in Docker the env is injected directly.
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// repo root is two levels up from server/src
const repoRoot = path.resolve(__dirname, '..', '..');

// Load .env from repo root if present (no-op when the file is absent).
dotenv.config({ path: path.join(repoRoot, '.env') });

const bool = (v, def = false) =>
  v === undefined ? def : /^(1|true|yes|on)$/i.test(String(v));

const num = (v, def) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const isProd = (process.env.NODE_ENV || 'production') === 'production';

// Storage path resolves relative to repo root when not absolute.
const storagePathRaw = process.env.STORAGE_PATH || './data';
const storagePath = path.isAbsolute(storagePathRaw)
  ? storagePathRaw
  : path.resolve(repoRoot, storagePathRaw);

const config = {
  isProd,
  env: process.env.NODE_ENV || 'production',
  host: process.env.HOST || '0.0.0.0',
  port: num(process.env.PORT, 8080),
  baseUrl: (process.env.BASE_URL || `http://localhost:${num(process.env.PORT, 8080)}`).replace(/\/+$/, ''),

  storagePath,
  filesDir: path.join(storagePath, 'files'),
  thumbsDir: path.join(storagePath, 'thumbnails'),
  dbPath: process.env.DB_PATH
    ? (path.isAbsolute(process.env.DB_PATH) ? process.env.DB_PATH : path.resolve(repoRoot, process.env.DB_PATH))
    : path.join(storagePath, 'printvault.db'),
  sessionDbDir: storagePath,

  allowedExtensions: (process.env.ALLOWED_EXTENSIONS ||
    'stl,3mf,obj,step,stp,gcode,zip,png,jpg,jpeg,webp')
    .split(',')
    .map((e) => e.trim().toLowerCase().replace(/^\./, ''))
    .filter(Boolean),
  maxUploadBytes: num(process.env.MAX_UPLOAD_MB, 500) * 1024 * 1024,
  maxUploadMb: num(process.env.MAX_UPLOAD_MB, 500),

  sessionSecret: process.env.SESSION_SECRET || 'insecure-dev-secret-change-me',
  adminUser: process.env.ADMIN_USER || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'changeme',

  // Path to the built client (production static serving).
  clientDist: path.join(repoRoot, 'client', 'dist'),
  repoRoot,
};

// Ensure storage directories exist on boot.
for (const dir of [config.storagePath, config.filesDir, config.thumbsDir]) {
  fs.mkdirSync(dir, { recursive: true });
}

if (config.isProd && config.sessionSecret === 'insecure-dev-secret-change-me') {
  console.warn('[PrintVault] WARNING: SESSION_SECRET is not set. Set it in .env for production.');
}

export default config;
