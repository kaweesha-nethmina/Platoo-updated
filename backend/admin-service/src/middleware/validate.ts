import { Request, Response, NextFunction } from "express";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateAdminInvite(req: Request, res: Response, next: NextFunction): void {
  const body = req.body ?? {};
  const email = body.email;
  const name = body.name;
  const password = body.password;

  const errors: string[] = [];

  if (typeof email !== "string" || email.length > 254 || !EMAIL_REGEX.test(email)) {
    errors.push("email must be a valid email address");
  }
  if (typeof name !== "string" || name.trim().length < 1 || name.trim().length > 100) {
    errors.push("name must be between 1 and 100 characters");
  }
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    errors.push("password must be between 8 and 128 characters");
  }

  if (errors.length > 0) {
    res.status(400).json({ error: "Validation failed", details: errors });
    return;
  }

  next();
}