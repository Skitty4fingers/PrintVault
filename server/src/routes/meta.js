// Tags, categories, settings, stats, export, health.
import { Router } from 'express';
import db from '../db.js';
import config from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { serializeFile, totalStorageUsed } from '../utils/files.js';
import { serializeShare } from './shares.js';

const router = Router();

router.get('/health', (_req, res) => res.json({ ok: true }));

router.get('/tags', requireAuth, (_req, res) => {
  const rows = db
    .prepare(`SELECT t.name AS name, COUNT(ft.file_id) AS count FROM tags t
              LEFT JOIN file_tags ft ON ft.tag_id = t.id
              GROUP BY t.id ORDER BY count DESC, t.name`)
    .all();
  res.json(rows);
});

router.get('/categories', requireAuth, (_req, res) => {
  const rows = db
    .prepare(`SELECT category AS name, COUNT(*) AS count FROM files
              WHERE category <> '' GROUP BY category ORDER BY count DESC, category`)
    .all();
  res.json(rows);
});

router.get('/settings', requireAuth, (_req, res) => {
  const get = (k) => { const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(k); return r ? r.value : null; };
  res.json({
    appName: get('appName') || 'PrintVault',
    shareDefaultExpiryDays: Number(get('shareDefaultExpiryDays') || 0),
    allowedExtensions: config.allowedExtensions,
    maxUploadMb: config.maxUploadMb,
    baseUrl: config.baseUrl,
    port: config.port,
    storagePath: config.storagePath,
  });
});

router.patch('/settings', requireAuth, (req, res) => {
  const set = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  if (typeof req.body.appName === 'string' && req.body.appName.trim()) set.run('appName', req.body.appName.trim());
  if (req.body.shareDefaultExpiryDays !== undefined) {
    set.run('shareDefaultExpiryDays', String(Math.max(0, parseInt(req.body.shareDefaultExpiryDays) || 0)));
  }
  res.json({ ok: true });
});

router.get('/stats', requireAuth, (_req, res) => {
  const fileCount = db.prepare('SELECT COUNT(*) AS n FROM files').get().n;
  const favorites = db.prepare('SELECT COUNT(*) AS n FROM files WHERE favorite = 1').get().n;
  const collections = db.prepare('SELECT COUNT(*) AS n FROM collections').get().n;
  const recentUploads = db.prepare('SELECT * FROM files ORDER BY created_at DESC LIMIT 8').all().map(serializeFile);
  const recentShareRows = db.prepare('SELECT * FROM shares WHERE revoked = 0 ORDER BY created_at DESC LIMIT 6').all();
  const byType = db.prepare('SELECT ext, COUNT(*) AS count FROM files GROUP BY ext ORDER BY count DESC').all();
  res.json({
    fileCount,
    favorites,
    collections,
    storageUsed: totalStorageUsed(),
    recentUploads,
    recentShares: recentShareRows.map(serializeShare),
    byType,
  });
});

router.get('/export', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM files ORDER BY created_at DESC').all();
  const files = rows.map(serializeFile);
  if (String(req.query.format).toLowerCase() === 'csv') {
    const cols = ['id', 'name', 'originalName', 'ext', 'size', 'category', 'tags', 'description', 'sourceUrl', 'printerNotes', 'materialNotes', 'profileNotes', 'favorite', 'createdAt'];
    const esc = (v) => {
      const s = Array.isArray(v) ? v.join('|') : String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [cols.join(','), ...files.map((f) => cols.map((c) => esc(f[c])).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="printvault-metadata.csv"');
    return res.send(csv);
  }
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="printvault-metadata.json"');
  res.send(JSON.stringify(files, null, 2));
});

export default router;
