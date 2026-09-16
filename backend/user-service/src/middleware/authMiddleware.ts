import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { UserRole } from "../models/User"; // Ensure UserRole is correctly imported

// Define the payload structure for the JWT token
interface UserPayload {
  id: string;
  role: UserRole;
}

// Extend the Express Request interface to include the user property
export interface AuthRequest extends Request {
  user?: UserPayload; // Adding user to the request interface
}

// Protect middleware to validate JWT and check roles
export const protect = (roles: UserRole[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
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
  
        req.user = decoded;
        next(); // Pass control to the next handler
      } catch (error) {
        res.status(401).json({ msg: "Unauthorized: Invalid token" });
      }
    };
  };
  