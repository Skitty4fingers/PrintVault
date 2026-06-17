// Collection routes: CRUD, membership, reorder, ZIP download.
import { Router } from 'express';
import fs from 'node:fs';
import archiver from 'archiver';
import { nanoid } from 'nanoid';
import db, { logActivity } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { serializeFile, resolveStoredPath } from '../utils/files.js';

const router = Router();

function countFiles(id) {
  return db.prepare('SELECT COUNT(*) AS n FROM collection_files WHERE collection_id = ?').get(id).n;
}

router.get('/', requireAuth, (_req, res) => {
  const rows = db.prepare('SELECT * FROM collections ORDER BY name COLLATE NOCASE').all();
  res.json(
    rows.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description || '',
      fileCount: countFiles(c.id),
      createdAt: c.created_at,
    }))
  );
});

router.post('/', requireAuth, (req, res) => {
  const name = (req.body && req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Collection name is required' });
  const id = nanoid();
  db.prepare('INSERT INTO collections (id, name, description) VALUES (?, ?, ?)').run(
    id, name, (req.body.description || '').trim()
  );
  logActivity('collection-create', name);
  res.json({ id, name, description: req.body.description || '', fileCount: 0 });
});

router.get('/:id', requireAuth, (req, res) => {
  const c = db.prepare('SELECT * FROM collections WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Collection not found' });
  const files = db
    .prepare(`SELECT f.* FROM files f
              JOIN collection_files cf ON cf.file_id = f.id
              WHERE cf.collection_id = ? ORDER BY cf.position ASC, f.name COLLATE NOCASE`)
    .all(c.id);
  res.json({
    id: c.id,
    name: c.name,
    description: c.description || '',
    createdAt: c.created_at,
    fileCount: files.length,
    files: files.map(serializeFile),
  });
});

router.patch('/:id', requireAuth, (req, res) => {
  const c = db.prepare('SELECT * FROM collections WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Collection not found' });
  const name = req.body.name !== undefined ? String(req.body.name).trim() : c.name;
  const description = req.body.description !== undefined ? String(req.body.description).trim() : c.description;
  db.prepare("UPDATE collections SET name=?, description=?, updated_at=datetime('now') WHERE id=?")
    .run(name || c.name, description, c.id);
  res.json({ id: c.id, name: name || c.name, description, fileCount: countFiles(c.id) });
});

router.delete('/:id', requireAuth, (req, res) => {
  const c = db.prepare('SELECT * FROM collections WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Collection not found' });
  db.prepare('DELETE FROM collections WHERE id = ?').run(c.id);
  // Any shares pointing at this collection become dead; revoke them.
  db.prepare("UPDATE shares SET revoked = 1 WHERE type = 'collection' AND target_id = ?").run(c.id);
  res.json({ ok: true });
});

router.post('/:id/files', requireAuth, (req, res) => {
  const c = db.prepare('SELECT * FROM collections WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Collection not found' });
  const ids = (req.body && req.body.ids) || [];
  const base = db.prepare('SELECT COALESCE(MAX(position),0) AS p FROM collection_files WHERE collection_id = ?').get(c.id).p;
  const ins = db.prepare('INSERT OR IGNORE INTO collection_files (collection_id, file_id, position) VALUES (?, ?, ?)');
  let pos = base;
  const tx = db.transaction(() => {
    for (const fid of ids) {
      if (db.prepare('SELECT 1 FROM files WHERE id = ?').get(fid)) ins.run(c.id, fid, ++pos);
    }
  });
  tx();
  res.json({ ok: true, fileCount: countFiles(c.id) });
});

router.delete('/:id/files/:fileId', requireAuth, (req, res) => {
  db.prepare('DELETE FROM collection_files WHERE collection_id = ? AND file_id = ?')
    .run(req.params.id, req.params.fileId);
  res.json({ ok: true });
});

router.post('/:id/reorder', requireAuth, (req, res) => {
  const ids = (req.body && req.body.ids) || [];
  const upd = db.prepare('UPDATE collection_files SET position = ? WHERE collection_id = ? AND file_id = ?');
  const tx = db.transaction(() => ids.forEach((fid, i) => upd.run(i, req.params.id, fid)));
  tx();
  res.json({ ok: true });
});

router.get('/:id/download', requireAuth, (req, res) => {
  const c = db.prepare('SELECT * FROM collections WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Collection not found' });
  const files = db
    .prepare(`SELECT f.* FROM files f JOIN collection_files cf ON cf.file_id = f.id
              WHERE cf.collection_id = ? ORDER BY cf.position`)
    .all(c.id);
  res.setHeader('Content-Type', 'application/zip');
  const safe = c.name.replace(/[^a-z0-9_-]+/gi, '_');
  res.setHeader('Content-Disposition', `attachment; filename="${safe || 'collection'}.zip"`);
  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.on('error', () => res.status(500).end());
  archive.pipe(res);
  const seen = {};
  for (const row of files) {
    try {
      const full = resolveStoredPath(row.stored_name);
      if (!fs.existsSync(full)) continue;
      let entry = row.original_name;
      if (seen[entry]) entry = `${row.id}-${entry}`;
      seen[entry] = true;
      archive.file(full, { name: entry });
    } catch { /* skip */ }
  }
  archive.finalize();
});

export default router;
