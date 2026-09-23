import type { Request } from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';

/**
 * NOTIFICATION-SERVICE rate limiter.
 *
 * NOTIF-03 (CWE-799): the previous limiter kept a single in-memory bucket per
 * client IP inside a Map. Every request from localhost (including that of
 * unrelated services / the frontend) shared one 10/minute budget, so a single
 * abuser or even a legitimate burst throttled everyone else, and the limit was
 * hard-coded. We now key by IP *and* authenticated user id, expose every
 * parameter via environment, and rely on the library's well-tested store.
 */

const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
const MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX || 25);

const keyGenerator = (req: Request): string => {
  // ERR_ERL_KEY_GEN_IPV6 guard: req.ip may be an IPv4-mapped IPv6 address.
  const ip = (req.ip || req.socket.remoteAddress || 'unknown').replace(/^::ffff:/, '');
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : '';
  if (token) {
    try {
      const decoded = jwt.decode(token) as { id?: string } | null;
      if (decoded && typeof decoded.id === 'string' && decoded.id.length > 0) {
        return `${ip}:${decoded.id}`;
      }
    } catch {
      // fall through to IP-only key
    }
  }
  return ip;
};

export const rateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: MAX_REQUESTS,
  keyGenerator,
  standardHeaders: true,
  legacyHeaders: true,
  message: { error: 'Too many requests, please slow down' },
});