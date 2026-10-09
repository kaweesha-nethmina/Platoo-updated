// =====================================================================
// [FIX VULN-01] JWT authentication middleware for VULN-01 (Missing
// authentication & authorization on all menu write endpoints) — Critical.
//
// WAS: menu-service had NO auth middleware; any write endpoint accepted
// requests with no / expired / alg:none tokens (evidence EV-M1, TC-BB-022/023).
//
// FIX: centrally reused `requireAuth` middleware mounted on the menu API
// routers. It ONLY accepts HS256-signed tokens validated against the real
// JWT_SECRET; alg:none, tampered or expired tokens return 401.
// =====================================================================
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    // HS256 pinning: jsonwebtoken rejects any other `alg` (e.g. alg:none, RS256).
    const payload = jwt.verify(token, process.env.JWT_SECRET as string, {
      algorithms: ['HS256'],
    }) as { id?: string; sub?: string; role?: string };

    // user-service signs jwt.sign({ id, role }, ...); accept `sub` too for
    // spec-correctness (§5.1). Exposed to handlers as req.user.
    (req as any).user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}