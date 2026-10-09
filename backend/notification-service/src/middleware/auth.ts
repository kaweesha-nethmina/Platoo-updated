import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface UserPayload {
  id: string;
  role: string;
}

export interface AuthRequest extends Request {
  user?: UserPayload;
}

const ALLOWED_ROLES = ['admin', 'restaurant_owner'];

export const protect = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

  if (!token) {
    res.status(401).json({ error: 'Unauthorized: No token provided' });
    return;
  }

  try {
    // NOTIF-01 (CWE-347): pin the algorithm to HS256 (matches the tokens issued
    // by user-service) and require the expected claims so an attacker can
    // never switch the algorithm (HS256/RS256 confusion) or craft payloads
    // without an id/role.
    const decoded = jwt.verify(token, process.env.JWT_SECRET || '', {
      algorithms: ['HS256'],
    }) as jwt.JwtPayload & { id: string; role: string };

    if (
      !decoded ||
      typeof decoded.id !== 'string' ||
      decoded.id.length === 0 ||
      typeof decoded.role !== 'string' ||
      !ALLOWED_ROLES.includes(decoded.role)
    ) {
      res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
      return;
    }

    req.user = { id: decoded.id, role: decoded.role };
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};