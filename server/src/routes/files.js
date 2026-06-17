// File routes: list/filter, upload, metadata CRUD, favorite, download, raw, bulk ops.
import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import archiver from 'archiver';
import { nanoid } from 'nanoid';
import db, { logActivity } from '../db.js';
import config from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import {
  extOf,
  isAllowedExt,
  sanitizeFilename,
  resolveStoredPath,
  serializeFile,
  setFileTags,
  addFileTags,
  removeFileTags,
  deleteStoredFile,
  thumbPath,
  parseFolderPath,
} from '../utils/files.js';

const router = Router();

// ---- Upload (multer to disk) -----------------------------------------------
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.filesDir),
  filename: (_req, file, cb) => {
    const ext = extOf(file.originalname);
    cb(null, `${nanoid()}.${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: config.maxUploadBytes },
  fileFilter: (_req, file, cb) => {
    if (isAllowedExt(extOf(file.originalname))) return cb(null, true);
    cb(null, false); // silently skip; reported as "skipped" below
  },
});

const insertFile = db.prepare(`
  INSERT INTO files (id, original_name, stored_name, ext, mime, size, name,
                     description, category, source_url, printer_notes, material_notes, profile_notes)
  VALUES (@id, @original_name, @stored_name, @ext, @mime, @size, @name,
          @description, @category, @source_url, @printer_notes, @material_notes, @profile_notes)
`);

// Find or create a collection by name, returning its id.
const findCollection = db.prepare('SELECT id FROM collections WHERE name = ? COLLATE NOCASE');
const insertCollection = db.prepare('INSERT INTO collections (id, name) VALUES (?, ?)');
const maxColPos = db.prepare('SELECT COALESCE(MAX(position),0) AS p FROM collection_files WHERE collection_id = ?');
const linkColFile = db.prepare('INSERT OR IGNORE INTO collection_files (collection_id, file_id, position) VALUES (?, ?, ?)');
function findOrCreateCollection(name) {
  const existing = findCollection.get(name);
  if (existing) return existing.id;
  const id = nanoid();
  insertCollection.run(id, name);
  return id;
}

router.post('/', requireAuth, upload.array('files'), (req, res) => {
  const body = req.body || {};
  const sharedTags = (body.tags || '').split(',').map((t) => t.trim()).filter(Boolean);
  // Folder upload extras: per-file relative paths + behaviour toggles.
  let relativePaths = [];
  try { relativePaths = JSON.parse(body.relativePaths || '[]'); } catch { relativePaths = []; }
  const autoTag = /^(1|true)$/i.test(String(body.autoTag));
  const autoCollections = /^(1|true)$/i.test(String(body.autoCollections));

  const uploaded = [];
  const collectionBuckets = {}; // topLevelFolder -> [fileId]

  (req.files || []).forEach((f, i) => {
    const ext = extOf(f.originalname);
    const id = f.filename.split('.')[0];
    const rel = relativePaths[i] || f.originalname;
    const { segments, topLevel } = parseFolderPath(rel);
    const display = sanitizeFilename(f.originalname).replace(/\.[^.]+$/, '');
    const row = {
      id,
      original_name: sanitizeFilename(f.originalname),
      stored_name: f.filename,
      ext,
      mime: f.mimetype || '',
      size: f.size,
      name: display || f.originalname,
      description: body.description || '',
      category: (body.category || '').trim(),
      source_url: body.sourceUrl || '',
      printer_notes: body.printerNotes || '',
      material_notes: body.materialNotes || '',
      profile_notes: body.profileNotes || '',
    };
    insertFile.run(row);

    // Tags: shared tags plus folder-derived tags when auto-tagging is on.
    const tags = [...sharedTags];
    if (autoTag) tags.push(...segments);
    if (tags.length) setFileTags(id, tags);

    if (autoCollections && topLevel) {
      (collectionBuckets[topLevel] ||= []).push(id);
    }
    uploaded.push(serializeFile(db.prepare('SELECT * FROM files WHERE id = ?').get(id)));
  });

  // Create/append collections from top-level folders.
  const collectionsCreated = [];
  const tx = db.transaction(() => {
    for (const [name, ids] of Object.entries(collectionBuckets)) {
      const cid = findOrCreateCollection(name);
      let pos = maxColPos.get(cid).p;
      for (const fid of ids) linkColFile.run(cid, fid, ++pos);
      collectionsCreated.push({ name, count: ids.length });
    }
  });
  tx();

  logActivity('upload', `${uploaded.length} file(s)`);
  res.json({ uploaded, skipped: [], collectionsCreated });
});

// ---- List with filters / search / sort / pagination ------------------------
router.get('/', requireAuth, (req, res) => {
  const { search, tag, category, type, favorite, collection } = req.query;
  const sortMap = { name: 'name', created_at: 'created_at', size: 'size', ext: 'ext' };
  const sort = sortMap[req.query.sort] || 'created_at';
  const order = String(req.query.order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize) || 60));

  const where = [];
  const params = {};
  if (search) {
    where.push('(f.name LIKE @q OR f.description LIKE @q OR f.original_name LIKE @q OR f.category LIKE @q)');
    params.q = `%${search}%`;
  }
  if (category) { where.push('f.category = @category'); params.category = category; }
  if (type) { where.push('f.ext = @type'); params.type = String(type).toLowerCase().replace(/^\./, ''); }
  if (favorite === '1') where.push('f.favorite = 1');
  if (tag) {
    where.push(`f.id IN (SELECT ft.file_id FROM file_tags ft JOIN tags t ON t.id = ft.tag_id WHERE t.name = @tag)`);
    params.tag = String(tag).toLowerCase();
  }
  if (collection) {
    where.push('f.id IN (SELECT file_id FROM collection_files WHERE collection_id = @collection)');
    params.collection = collection;
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = db.prepare(`SELECT COUNT(*) AS n FROM files f ${whereSql}`).get(params).n;
  const rows = db
    .prepare(`SELECT * FROM files f ${whereSql} ORDER BY ${sort} ${order} LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit: pageSize, offset: (page - 1) * pageSize });

  res.json({ items: rows.map(serializeFile), total, page, pageSize });
});

// ---- Single file metadata --------------------------------------------------
router.get('/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'File not found' });
  res.json(serializeFile(row));
});

// ---- Edit metadata ---------------------------------------------------------
router.patch('/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'File not found' });
  const b = req.body || {};
  const fields = {
    name: b.name ?? row.name,
    description: b.description ?? row.description,
    category: ((b.category ?? row.category) || '').trim(),
    source_url: b.sourceUrl ?? row.source_url,
    printer_notes: b.printerNotes ?? row.printer_notes,
    material_notes: b.materialNotes ?? row.material_notes,
    profile_notes: b.profileNotes ?? row.profile_notes,
  };
  db.prepare(`UPDATE files SET name=@name, description=@description, category=@category,
    source_url=@source_url, printer_notes=@printer_notes, material_notes=@material_notes,
    profile_notes=@profile_notes, updated_at=datetime('now') WHERE id=@id`).run({ ...fields, id: row.id });
  if (Array.isArray(b.tags)) setFileTags(row.id, b.tags);
  res.json(serializeFile(db.prepare('SELECT * FROM files WHERE id = ?').get(row.id)));
});

// ---- Delete ----------------------------------------------------------------
router.delete('/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'File not found' });
  db.prepare('DELETE FROM files WHERE id = ?').run(row.id);
  deleteStoredFile(row.stored_name, row.id);
  logActivity('delete', row.name);
  res.json({ ok: true });
});

// ---- Favorite toggle -------------------------------------------------------
router.post('/:id/favorite', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'File not found' });
  const fav = req.body && typeof req.body.favorite === 'boolean' ? (req.body.favorite ? 1 : 0) : (row.favorite ? 0 : 1);
  db.prepare('UPDATE files SET favorite = ? WHERE id = ?').run(fav, row.id);
  res.json(serializeFile(db.prepare('SELECT * FROM files WHERE id = ?').get(row.id)));
});

// ---- Stream helpers --------------------------------------------------------
function streamFile(res, row, { attachment }) {
  let full;
  try {
    full = resolveStoredPath(row.stored_name);
  } catch {
    return res.status(400).json({ error: 'Invalid file path' });
  }
  if (!fs.existsSync(full)) return res.status(404).json({ error: 'File missing on disk' });
  const disp = attachment ? 'attachment' : 'inline';
  res.setHeader('Content-Disposition', `${disp}; filename="${encodeURIComponent(row.original_name)}"`);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  fs.createReadStream(full).pipe(res);
}

router.get('/:id/download', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'File not found' });
  streamFile(res, row, { attachment: true });
});

router.get('/:id/raw', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'File not found' });
  streamFile(res, row, { attachment: false });
});

// ---- Thumbnails ------------------------------------------------------------
// Thumbnails are PNGs rendered by the browser at upload time (for STL/OBJ) and
// uploaded here. Kept small; stored on disk by internal id.
const thumbUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, (file.mimetype || '').startsWith('image/')),
});

router.post('/:id/thumbnail', requireAuth, thumbUpload.single('thumb'), (req, res) => {
  const row = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'File not found' });
  if (!req.file) return res.status(400).json({ error: 'No thumbnail image provided' });
  fs.writeFileSync(thumbPath(row.id), req.file.buffer);
  db.prepare('UPDATE files SET thumb = 1 WHERE id = ?').run(row.id);
  res.json({ ok: true });
});

router.get('/:id/thumbnail', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'File not found' });
  const p = thumbPath(row.id);
  if (!fs.existsSync(p)) return res.status(404).json({ error: 'No thumbnail' });
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'private, max-age=86400');
  fs.createReadStream(p).pipe(res);
});

// ---- Bulk download as ZIP --------------------------------------------------
router.post('/bulk/download', requireAuth, (req, res) => {
  const ids = (req.body && req.body.ids) || [];
  if (!ids.length) return res.status(400).json({ error: 'No files selected' });
  const rows = db
    .prepare(`SELECT * FROM files WHERE id IN (${ids.map(() => '?').join(',')})`)
    .all(...ids);
  if (!rows.length) return res.status(404).json({ error: 'No matching files' });

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="printvault-export.zip"');
  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.on('error', () => res.status(500).end());
  archive.pipe(res);
  const seen = {};
  for (const row of rows) {
    try {
      const full = resolveStoredPath(row.stored_name);
      if (!fs.existsSync(full)) continue;
      let entry = row.original_name;
      if (seen[entry]) entry = `${row.id}-${entry}`; // de-dupe names within the zip
      seen[entry] = true;
      archive.file(full, { name: entry });
    } catch { /* skip unsafe */ }
  }
  archive.finalize();
});

// ---- Bulk tag editing ------------------------------------------------------
router.post('/bulk/tag', requireAuth, (req, res) => {
  const { ids = [], addTags = [], removeTags = [], category } = req.body || {};
  if (!ids.length) return res.status(400).json({ error: 'No files selected' });
  const tx = db.transaction(() => {
    for (const id of ids) {
      const row = db.prepare('SELECT id FROM files WHERE id = ?').get(id);
      if (!row) continue;
      if (addTags.length) addFileTags(id, addTags);
      if (removeTags.length) removeFileTags(id, removeTags);
      if (typeof category === 'string') {
        db.prepare("UPDATE files SET category = ?, updated_at = datetime('now') WHERE id = ?").run(category.trim(), id);
      }
    }
  });
  tx();
  res.json({ updated: ids.length });
});

// ---- Bulk delete -----------------------------------------------------------
router.post('/bulk/delete', requireAuth, (req, res) => {
  const ids = (req.body && req.body.ids) || [];
  if (!ids.length) return res.status(400).json({ error: 'No files selected' });
  let deleted = 0;
  const tx = db.transaction(() => {
    for (const id of ids) {
      const row = db.prepare('SELECT * FROM files WHERE id = ?').get(id);
      if (!row) continue;
      db.prepare('DELETE FROM files WHERE id = ?').run(id);
      deleteStoredFile(row.stored_name, row.id);
      deleted++;
    }
  });
  tx();
  logActivity('bulk-delete', `${deleted} file(s)`);
  res.json({ deleted });
});

export default router;
