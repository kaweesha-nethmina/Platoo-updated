import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { createHash } from "crypto";
import { UserRole } from "../models/User"; // Ensure UserRole is correctly imported
import TokenBlacklist from "../models/TokenBlacklist";

// Define the payload structure for the JWT token
interface UserPayload {
  id: string;
  role: UserRole;
}

// Extend the Express Request interface to include the user property
export interface AuthRequest extends Request {
  user?: UserPayload; // Adding user to the request interface
}

// Store a SHA-256 fingerprint of the raw token (never the token itself) so a
// revoked token keeps being rejected without persisting recoverable secrets.
export const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

// Server-side revocation: returns true when the presented token is rejected.
// Lookup failures fail closed (401) so a revocation can never be bypassed by
// an outage of the check itself.
const isRevoked = async (token: string): Promise<boolean> => {
  try {
    const hit = await TokenBlacklist.exists({ tokenHash: hashToken(token) });
    return hit !== null;
  } catch (error) {
    console.error("[user-service] token blacklist check failed:", error);
    return true;
  }
};

// Protect middleware to validate JWT and check roles
export const protect = (roles: UserRole[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      res.status(401).json({ msg: "Unauthorized: No token provided" });
      return;
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as UserPayload;
      if (!roles.includes(decoded.role)) {
        res.status(403).json({ msg: "Forbidden: Insufficient permissions" });
        return;
      }
      if (await isRevoked(token)) {
        res.status(401).json({ msg: "Unauthorized: Token revoked" });
        return;
      }
      req.user = decoded;
      next();
    } catch (error) {
      res.status(401).json({ msg: "Unauthorized: Invalid token" });
    }
  };
};
  