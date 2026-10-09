import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  user?: { id: string; role: string };
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

  if (!token) {
    res.status(401).json({ message: "Unauthorized: No token provided" });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; role: string };
    if (decoded.role !== "admin") {
      res.status(403).json({ message: "Forbidden: Admin access required" });
      return;
    }
    req.user = decoded;
    next();
  } catch (error) {
    console.error("requireAdmin: token verification failed:", error);
    res.status(401).json({ message: "Unauthorized: Invalid token" });
  }
}