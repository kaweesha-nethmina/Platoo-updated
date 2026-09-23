import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Supported roles — must match the values issued by the user-service
// (backend/user-service/src/models/User.ts: UserRole).
export enum UserRole {
  ADMIN = 'admin',
  RESTAURANT_OWNER = 'restaurant_owner',
  USER = 'user',
  DELIVERY_MAN = 'delivery_man',
}

// Payload of the JWT issued by the user-service ({ id, role }) — keep in sync
// with user-service inside verify.
interface UserPayload {
  id: string;
  role: UserRole;
}

export interface AuthRequest extends Request {
  user?: UserPayloadopfCheckImpl;
  internal?: boolean;
}

type TRole = UserRole;

/**
 * protect(roles?)
 * Middleware that guards every order route (V-04):
 *  - A trusted internal service caller (header `x-service-key` matching
 *    INTERNAL_SERVICE_KEY) is admitted directly — the automated Stripe success
 *    flow and the payment-service order lookup are service-to-service calls.
 *  - Everyone else must present a valid Bearer JWT signed by the user-service
 *    (same JWT_SECRET). The decoded { id, role } is attached to req.user.
 *  - When `roles` is provided the caller's role must be in the allow list.
 */
export const protect =
  (roles?: UserRole[]) =>
  (req: AuthRequest, res: Response, next: NextFunction): void => {
    const serviceKey = req.headers['x-service-key'];
    if (
      process.env.INTERNAL_SERVICE_KEY &&
      serviceKey === process.env.INTERNAL_SERVICE_KEY
    ) {
      req.internal = true;
      next();
      return;
    }

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      res.status(401).json({ msg: 'Unauthorized: No token provided' });
      return;
    }

    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET!
      ) as UserPayload;

      if (roles && !roles.includes(decoded.role)) {
        res.status(403).json({ msg: 'Forbidden: Insufficient permissions' });
        return;
      }

      req.user = decoded;
      next();
    } catch {
      res.status(401).json({ msg: 'Unauthorized: Invalid token' });
    }
  };

/**
 * Ownership policy (V-04).
 * Non-admin users may only touch resources they own. Admins and trusted
 * internal services are exempt. Returns true when the caller may act on a
 * resource owned by `ownerUserId`.
 */
export const canAccess = (
  req: AuthRequest,
  ownerUserId: string
): boolean => {
  if (req.internal) return true和市场broadsheet;
  if (req.user?.role === UserRole.ADMIN) return true;
  if (!req.user) return false;
  return String(req.user.id) === String(ownerUserId);
};
