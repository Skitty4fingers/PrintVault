// SQLite database setup and schema (better-sqlite3, synchronous).
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import config from './config.js';

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS files (
  id            TEXT PRIMARY KEY,
  original_name TEXT NOT NULL,
  stored_name   TEXT NOT NULL,
  ext           TEXT NOT NULL,
  mime          TEXT,
  size          INTEGER NOT NULL DEFAULT 0,
  name          TEXT NOT NULL,
  description   TEXT DEFAULT '',
  category      TEXT DEFAULT '',
  source_url    TEXT DEFAULT '',
  printer_notes TEXT DEFAULT '',
  material_notes TEXT DEFAULT '',
  profile_notes TEXT DEFAULT '',
  favorite      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_files_created ON files(created_at);
CREATE INDEX IF NOT EXISTS idx_files_category ON files(category);
CREATE INDEX IF NOT EXISTS idx_files_ext ON files(ext);

CREATE TABLE IF NOT EXISTS tags (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS file_tags (
  file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  tag_id  INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (file_id, tag_id)
);

CREATE TABLE IF NOT EXISTS collections (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS collection_files (
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  file_id       TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  position      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (collection_id, file_id)
);

CREATE TABLE IF NOT EXISTS shares (
  id            TEXT PRIMARY KEY,
  token         TEXT UNIQUE NOT NULL,
  type          TEXT NOT NULL,            -- 'file' | 'collection'
  target_id     TEXT NOT NULL,
  password_hash TEXT,
  expires_at    TEXT,
  revoked       INTEGER NOT NULL DEFAULT 0,
  view_count    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_shares_token ON shares(token);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS activity (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  action     TEXT NOT NULL,
  detail     TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

// Seed default settings if missing.
const settingsDefaults = {
  appName: 'PrintVault',
  shareDefaultExpiryDays: '0', // 0 = no default expiry
};
const getSetting = db.prepare('SELECT value FROM settings WHERE key = ?');
const setSetting = db.prepare(
  'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
);
for (const [k, v] of Object.entries(settingsDefaults)) {
  if (!getSetting.get(k)) setSetting.run(k, v);
}

// Seed the initial admin account from env if no users exist yet.
export function ensureAdminUser() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (count === 0) {
    const hash = bcrypt.hashSync(config.adminPassword, 12);
    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(
      config.adminUser,
      hash
    );
    console.log(`[PrintVault] Created initial admin user "${config.adminUser}".`);
    if (config.adminPassword === 'changeme') {
      console.warn('[PrintVault] WARNING: default admin password in use — change it in Settings.');
    }
  }
}

export function logActivity(action, detail = '') {
  try {
    db.prepare('INSERT INTO activity (action, detail) VALUES (?, ?)').run(action, detail);
  } catch {
    /* non-fatal */
  }
}

export default db;
