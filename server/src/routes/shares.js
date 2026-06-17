// Admin-only share link management: list, create, revoke.
import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import db, { logActivity } from '../db.js';
import config from '../config.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function targetName(type, id) {
  if (type === 'file') {
    const r = db.prepare('SELECT name FROM files WHERE id = ?').get(id);
    return r ? r.name : '(deleted file)';
  }
  const r = db.prepare('SELECT name FROM collections WHERE id = ?').get(id);
  return r ? r.name : '(deleted collection)';
}

export function serializeShare(s) {
  return {
    id: s.id,
    token: s.token,
    type: s.type,
    targetId: s.target_id,
    targetName: targetName(s.type, s.target_id),
    url: `${config.baseUrl}/share/${s.token}`,
    expiresAt: s.expires_at,
    hasPassword: !!s.password_hash,
    revoked: !!s.revoked,
    viewCount: s.view_count,
    createdAt: s.created_at,
  };
}

router.get('/', requireAuth, (_req, res) => {
  const rows = db.prepare('SELECT * FROM shares ORDER BY created_at DESC').all();
  res.json(rows.map(serializeShare));
});

router.post('/', requireAuth, (req, res) => {
  const { type, targetId, expiresAt, password } = req.body || {};
  if (!['file', 'collection'].includes(type) || !targetId) {
    return res.status(400).json({ error: 'type (file|collection) and targetId are required' });
  }
  // Validate target exists.
  const exists =
    type === 'file'
      ? db.prepare('SELECT 1 FROM files WHERE id = ?').get(targetId)
      : db.prepare('SELECT 1 FROM collections WHERE id = ?').get(targetId);
  if (!exists) return res.status(404).json({ error: 'Share target not found' });

  const id = nanoid();
  const token = crypto.randomBytes(24).toString('base64url'); // unguessable
  const password_hash = password ? bcrypt.hashSync(String(password), 10) : null;
  let expires = null;
  if (expiresAt) {
    const d = new Date(expiresAt);
    if (!isNaN(d.getTime())) expires = d.toISOString();
  }
  db.prepare(
    'INSERT INTO shares (id, token, type, target_id, password_hash, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, token, type, targetId, password_hash, expires);
  logActivity('share-create', `${type}:${targetId}`);
  res.json(serializeShare(db.prepare('SELECT * FROM shares WHERE id = ?').get(id)));
});

router.delete('/:id', requireAuth, (req, res) => {
  const s = db.prepare('SELECT * FROM shares WHERE id = ?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Share not found' });
  db.prepare('UPDATE shares SET revoked = 1 WHERE id = ?').run(s.id);
  logActivity('share-revoke', s.token);
  res.json({ ok: true });
});

export default router;
