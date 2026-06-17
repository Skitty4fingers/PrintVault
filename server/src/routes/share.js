// PUBLIC read-only share access. No admin auth. Never exposes admin functions.
import { Router } from 'express';
import fs from 'node:fs';
import bcrypt from 'bcryptjs';
import archiver from 'archiver';
import db from '../db.js';
import { shareLimiter } from '../middleware/auth.js';
import { serializeFile, resolveStoredPath } from '../utils/files.js';

const router = Router();
router.use(shareLimiter);

// Load a share by token and compute its state. Returns null if not found.
function loadShare(token) {
  const s = db.prepare('SELECT * FROM shares WHERE token = ?').get(token);
  if (!s) return null;
  const expired = s.expires_at ? new Date(s.expires_at).getTime() < Date.now() : false;
  return { ...s, expired, revoked: !!s.revoked };
}

// Has this browser session been granted access to a password-protected share?
function isAuthorized(req, share) {
  if (!share.password_hash) return true;
  const grants = (req.session && req.session.shareGrants) || [];
  return grants.includes(share.token);
}

// Resolve the list of files a share exposes (file -> [file]; collection -> members).
function shareFiles(share) {
  if (share.type === 'file') {
    const row = db.prepare('SELECT * FROM files WHERE id = ?').get(share.target_id);
    return row ? [row] : [];
  }
  return db
    .prepare(`SELECT f.* FROM files f JOIN collection_files cf ON cf.file_id = f.id
              WHERE cf.collection_id = ? ORDER BY cf.position`)
    .all(share.target_id);
}

function targetDisplayName(share) {
  if (share.type === 'file') {
    const r = db.prepare('SELECT name FROM files WHERE id = ?').get(share.target_id);
    return r ? r.name : 'Shared file';
  }
  const r = db.prepare('SELECT name FROM collections WHERE id = ?').get(share.target_id);
  return r ? r.name : 'Shared collection';
}

// Guard: share must exist and be live (not revoked/expired). Returns share or sends error.
function liveShareOr(res, share) {
  if (!share) { res.status(404).json({ error: 'Share not found' }); return null; }
  if (share.revoked) { res.status(410).json({ error: 'This link has been revoked' }); return null; }
  if (share.expired) { res.status(410).json({ error: 'This link has expired' }); return null; }
  return share;
}

// ---- Metadata (always safe to return; never leaks file contents) -----------
router.get('/:token', (req, res) => {
  const share = loadShare(req.params.token);
  if (!share) return res.status(404).json({ error: 'Share not found', notFound: true });
  res.json({
    type: share.type,
    name: targetDisplayName(share),
    requiresPassword: !!share.password_hash,
    expired: share.expired,
    revoked: share.revoked,
    expiresAt: share.expires_at,
    authorized: !share.revoked && !share.expired && isAuthorized(req, share),
  });
});

// ---- Password unlock -------------------------------------------------------
router.post('/:token/auth', (req, res) => {
  const share = liveShareOr(res, loadShare(req.params.token));
  if (!share) return;
  if (!share.password_hash) return res.json({ authorized: true });
  const password = (req.body && req.body.password) || '';
  if (!bcrypt.compareSync(String(password), share.password_hash)) {
    return res.status(401).json({ error: 'Incorrect password' });
  }
  req.session.shareGrants = [...new Set([...(req.session.shareGrants || []), share.token])];
  res.json({ authorized: true });
});

// Middleware enforcing live + authorized for content routes.
function requireShareAccess(req, res, next) {
  const share = liveShareOr(res, loadShare(req.params.token));
  if (!share) return;
  if (!isAuthorized(req, share)) return res.status(401).json({ error: 'Password required' });
  req.share = share;
  next();
}

// ---- List shared files -----------------------------------------------------
router.get('/:token/files', requireShareAccess, (req, res) => {
  db.prepare('UPDATE shares SET view_count = view_count + 1 WHERE id = ?').run(req.share.id);
  // Only return metadata for files within this share — nothing else.
  res.json(shareFiles(req.share).map(serializeFile));
});

function streamShared(req, res, attachment) {
  const files = shareFiles(req.share);
  const row = files.find((f) => f.id === req.params.fileId);
  if (!row) return res.status(404).json({ error: 'File not in this share' });
  let full;
  try { full = resolveStoredPath(row.stored_name); }
  catch { return res.status(400).json({ error: 'Invalid path' }); }
  if (!fs.existsSync(full)) return res.status(404).json({ error: 'File missing' });
  res.setHeader('Content-Disposition',
    `${attachment ? 'attachment' : 'inline'}; filename="${encodeURIComponent(row.original_name)}"`);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  fs.createReadStream(full).pipe(res);
}

router.get('/:token/file/:fileId/download', requireShareAccess, (req, res) => streamShared(req, res, true));
router.get('/:token/file/:fileId/raw', requireShareAccess, (req, res) => streamShared(req, res, false));

// ---- Download a shared collection as ZIP -----------------------------------
router.get('/:token/download', requireShareAccess, (req, res) => {
  const files = shareFiles(req.share);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${req.share.type}-${req.params.token.slice(0, 8)}.zip"`);
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
