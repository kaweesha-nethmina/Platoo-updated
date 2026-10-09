import { Request, Response, NextFunction } from 'express';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 5 * 60 * 1000;
const MAX_REQUESTS = 120;

const sweep = (now: number): void => {
  if (buckets.size < 1000) return;
  for (const [ip, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(ip);
    }
  }
};

export const rateLimitDirections = (req: Request, res: Response, next: NextFunction): void => {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(ip);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    next();
    return;
  }

  if (bucket.count >= MAX_REQUESTS) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    res.set('Retry-After', String(retryAfter));
    res.status(429).json({ error: 'Too many requests' });
    return;
  }

  bucket.count += 1;
  next();
};