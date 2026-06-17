// Authentication + rate-limiting middleware.
import rateLimit from 'express-rate-limit';

// Require a logged-in admin session for protected API routes.
export function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  return res.status(401).json({ error: 'Authentication required' });
}

// Limit login attempts to slow down brute-force guessing.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later.' },
});

// Limit public share endpoints (password guessing / scraping).
export const shareLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
