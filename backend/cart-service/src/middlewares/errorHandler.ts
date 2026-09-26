// =====================================================================
// [FIX VULN-07] Central error handler for cart-service (Internal error
// leakage) — Medium.
//
// WAS: the file was EMPTY and every controller swallowed errors into a
// 500 body that included the ENTIRE error object (`{ message, error }`),
// leaking stack traces / internal details (evidence EV-C4, EV-C6).
//
// FIX: generic, correctly-typed responses. Client input errors
// (ValidationError/CastError/SyntaxError) -> 400; everything else -> 500.
// Internals are only revealed outside production.
// =====================================================================
import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error & { name?: string },
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const isClientErr = ['ValidationError', 'CastError', 'SyntaxError'].includes(err.name ?? '');
  res.status(isClientErr ? 400 : 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Request failed' : (err.message ?? 'Unknown error'),
  });
}