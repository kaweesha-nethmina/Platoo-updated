import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Role strings MUST match the tokens issued by the user-service
// (authController.generateToken): { id, role } signed with the same JWT_SECRET.
export const USER_ROLE = {
  ADMIN: 'admin',
  RESTAURANT_OWNER: 'restaurant_owner',
  USER: 'user',
  DELIVERY_MAN: 'delivery_man',
} as const;

export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE];

export interface AuthUser {
  id: string;
  role: UserRole;
}

// Extend Express Request with the authenticated user plus an internal flag used
// for trusted service-to-service calls (e.g. payment-service fetching an order).
export interface AuthRequest extends Request {
  user?: AuthUser;
  internal?: boolean;
}

/**
 * JWT protection middleware for the order-service (V-04).
 *
 * - Trusted internal services authenticate with the shared INTERNAL_SERVICE_KEY
 *   header and are treated as admin (no user-scoping).
 * - All browser callers must present a Bearer token issued by the user-service
 *   (same JWT_SECRET); the token is verified here and its payload is attached to
 *   `req.user` so controllers can enforce ownership.
 *
 * `roles` (optional) restricts the route to a specific set of roles.
 */
export const protect =
  (roles?: UserRole[]) =>
  (req: AuthRequest, res: Response, next: NextFunction): void => {
    // Trusted service-to-service call.
    if (
      process.env.INTERNAL_SERVICE_KEY &&
      req.headers['x-internal-key'] === process.env.INTERNAL_SERVICE_KEY
    ) {
      req.user = { id: 'internal', role: USER_ROLE.ADMIN };
      req.internal = true;
      return next();
    }

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      res.status(401).json({ message: 'Unauthorized: No token provided' });
      return;
    }

    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET!
      ) as AuthUser;

      if (roles && !roles.includes(decoded.role)) {
        res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
        return;
      }

      req.user = decoded;
      next();
    } catch {
      res.status(401).json({ message: 'Unauthorized: Invalid token' });
    }
  };

/**
 * Resource ownership check. Admins and trusted internal services may access
 * anything; any other user may only touch resources they own.
 */
export const isOwnerOrPrivileged = (
  req: AuthRequest,
  ownerUserId: string
): boolean =>
  req.internal === true ||
  (req.user?.role === USER_ROLE.ADMIN) ||
  String(req.user?.id) === String(ownerUserId);
