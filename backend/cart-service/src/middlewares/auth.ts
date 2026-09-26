// =====================================================================
// [FIX VULN-02] JWT authentication middleware for VULN-02 (Missing
// authentication + IDOR on cart-service, client-controlled userId) — Critical.
//
// WAS: cart-service had no auth; any client could read/modify anyone's cart
// (evidence EV-C1, TC-BB-064/069/075).
//
// FIX: every cart endpoint now requires a valid HS256 token; controllers
// derive identity from the token instead of the request body/URL.
// =====================================================================
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (!token) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  try {
    // HS256 pinning: jsonwebtoken rejects any other `alg` (e.g. alg:none).
    const payload = jwt.verify(token, process.env.JWT_SECRET as string, {
      algorithms: ['HS256'],
    }) as { id?: string; sub?: string; role?: string };

    // user-service signs jwt.sign({ id, role }, ...); accept `sub` too.
    (req as any).user = payload;
    next();
  } catch {
    res.status(401).json({ message: 'Unauthorized' });
  }
}