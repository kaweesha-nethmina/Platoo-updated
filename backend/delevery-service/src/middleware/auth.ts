import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface UserPayload {
  id: string;
  role: string;
}

export interface AuthRequest extends Request {
  user?: UserPayload;
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

  if (!token) {
    res.status(401).json({ message: "Unauthorized: No token provided" });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as UserPayload;
    req.user = { id: decoded.id, role: decoded.role };
    next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized: Invalid token" });
  }
};

export const requireRoles = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ message: "Forbidden: Insufficient permissions" });
      return;
    }
    next();
  };
};

export const requireDriverMatch = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  if (req.user.role === "admin") {
    next();
    return;
  }
  if (req.user.role !== "delivery_man") {
    res.status(403).json({ message: "Forbidden: Insufficient permissions" });
    return;
  }
  const driverId = req.params.driverId;
  if (driverId && driverId !== req.user.id) {
    res.status(403).json({ message: "Forbidden: You can only view your own deliveries" });
    return;
  }
  next();
};