import { Request, Response, NextFunction } from "express";

const IP_WINDOW_MS = 15 * 60 * 1000;
const IP_MAX_REQUESTS = 10;
const RECIPIENT_WINDOW_MS = 60 * 60 * 1000;
const RECIPIENT_MAX_INVITES = 3;

const ipHits = new Map<string, number[]>();
const recipientHits = new Map<string, number[]>();

function prune(map: Map<string, number[]>, windowMs: number): void {
  const cutoff = Date.now() - windowMs;
  for (const [key, timestamps] of map) {
    const active = timestamps.filter((t) => t > cutoff);
    if (active.length === 0) {
      map.delete(key);
    } else {
      map.set(key, active);
    }
  }
}

export function rateLimitInvites(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket?.remoteAddress || "unknown";
  const now = Date.now();
  prune(ipHits, IP_WINDOW_MS);

  const hits = ipHits.get(ip) ?? [];
  if (hits.length >= IP_MAX_REQUESTS) {
    res.status(429).json({ error: "Too many requests, please try again later" });
    return;
  }

  ipHits.set(ip, [...hits, now]);
  next();
}

export function isRecipientRateLimited(email: string): boolean {
  if (!email) return true;
  const key = email.toLowerCase();
  prune(recipientHits, RECIPIENT_WINDOW_MS);
  const hits = recipientHits.get(key) ?? [];
  return hits.length >= RECIPIENT_MAX_INVITES;
}

export function recordRecipientInvite(email: string): void {
  if (!email) return;
  const key = email.toLowerCase();
  const hits = recipientHits.get(key) ?? [];
  recipientHits.set(key, [...hits, Date.now()]);
}