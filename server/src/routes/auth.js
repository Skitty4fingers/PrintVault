// Auth routes: login, logout, current user, change password.
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db, { logActivity } from '../db.js';
import { requireAuth, loginLimiter } from '../middleware/auth.js';

const router = Router();

router.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(String(username));
  if (!user || !bcrypt.compareSync(String(password), user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  req.session.userId = user.id;
  req.session.username = user.username;
  logActivity('login', user.username);
  res.json({ user: { username: user.username } });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

router.get('/me', (req, res) => {
  if (req.session && req.session.userId) {
    return res.json({ user: { username: req.session.username } });
  }
  res.status(401).json({ error: 'Not authenticated' });
});

router.post('/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required' });
  }
  if (String(newPassword).length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  if (!user || !bcrypt.compareSync(String(currentPassword), user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  const hash = bcrypt.hashSync(String(newPassword), 12);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
  logActivity('change-password', user.username);
  res.json({ ok: true });
});

export default router;
