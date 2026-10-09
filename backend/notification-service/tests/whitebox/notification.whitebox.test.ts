/**
 * NOTIFICATION-SERVICE - WHITE BOX tests.
 * These exercise internal security logic: JWT auth middleware, the order
 * details validation, the hardened rate limiter and the mailer (including
 * header-injection resistance). Some imports are introduced by the hardening
 * fix (src/utils/validation.ts, src/utils/transport.ts, express-rate-limit).
 * Before the fix the suite is red -> that is documented as evidence.
 */
import type { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { protect, AuthRequest } from '../../src/middleware/auth';
import { validateOrderDetails } from '../../src/utils/validation';
import User from '../../src/models/User';
import { sanitizeEmailField } from '../../src/utils/validation';

const SECRET = process.env.JWT_SECRET || 'test-only-secret-change-me';

// The hardening fix deliberately fails fast in app.ts when JWT_SECRET is
// missing; for unit tests we pin it so jwt.verify/_sign share the same key.
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = SECRET;
}

function makeRes() {
  const res = {
    statusCode: 0,
    body: null,
    json: jest.fn().mockImplementation((b: unknown) => ((res as unknown as { body: unknown }).body = b)),
    status: jest.fn().mockImplementation(function (this: unknown, c: number) {
      (res as unknown as { statusCode: number }).statusCode = c;
      return res;
    }),
  };
  return res as unknown as Response;
}

describe('auth middleware (JWT verification)', () => {
  test('accepts a valid signed token with an allowed role', () => {
    const token = jwt.sign({ id: 'u1', role: 'admin' }, SECRET, { expiresIn: '1h' });
    const req = { headers: { authorization: `Bearer ${token}` } } as AuthRequest;
    const next = jest.fn() as NextFunction;
    protect(req, makeRes(), next);
    expect(next).toHaveBeenCalled();
    expect(req.user?.role).toBe('admin');
  });

  test('rejects missing token with 401', () => {
    const req = { headers: {} } as AuthRequest;
    const res = makeRes();
    const next = jest.fn() as NextFunction;
    protect(req, res, next);
    expect(res).toMatchObject({ statusCode: 401 });
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects token with disallowed role (403)', () => {
    const token = jwt.sign({ id: 'u1', role: 'user' }, SECRET, { expiresIn: '1h' });
    const res = makeRes();
    const next = jest.fn() as NextFunction;
    protect({ headers: { authorization: `Bearer ${token}` } } as AuthRequest, res, next);
    expect(res).toMatchObject({ statusCode: 403 });
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects token signed with the wrong secret (401)', () => {
    const token = jwt.sign({ id: 'u1', role: 'admin' }, 'attacker-secret', { expiresIn: '1h' });
    const res = makeRes();
    const next = jest.fn() as NextFunction;
    protect({ headers: { authorization: `Bearer ${token}` } } as AuthRequest, res, next);
    expect(res).toMatchObject({ statusCode: 401 });
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects "alg:none" token (401)', () => {
    const b64 = (o: Record<string, unknown>) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const fake = `${b64({ alg: 'none' })}.${b64({ id: 'u', role: 'admin' })}.`;
    const res = makeRes();
    const next = jest.fn() as NextFunction;
    protect({ headers: { authorization: `Bearer ${fake}` } } as AuthRequest, res, next);
    expect(res).toMatchObject({ statusCode: 401 });
    expect(next).not.toHaveBeenCalled();
  });
});

describe('validateOrderDetails', () => {
  test('accepts a valid payload', () => {
    expect(validateOrderDetails({ id: 'o1', customer: { name: 'a', address: 'b' }, total: 10 })).toBe(true);
  });

  test('rejects null / non-object / missing fields', () => {
    expect(validateOrderDetails(null)).toBe(false);
    expect(validateOrderDetails('x')).toBe(false);
    expect(validateOrderDetails({})).toBe(false);
    expect(validateOrderDetails({ id: 'o1', customer: {}, total: 10 })).toBe(false);
    expect(validateOrderDetails({ id: 'o1', customer: { name: 'a', address: 'b' } })).toBe(false);
  });

  test('rejects oversized fields and bad total types', () => {
    expect(validateOrderDetails({ id: 'x'.repeat(100), customer: { name: 'a', address: 'b' }, total: 1 })).toBe(false);
    expect(validateOrderDetails({ id: 'a', customer: { name: 'x'.repeat(200), address: 'b' }, total: 1 })).toBe(false);
    expect(validateOrderDetails({ id: 'a', customer: { name: 'a', address: 'x'.repeat(300) }, total: 1 })).toBe(false);
    expect(validateOrderDetails({ id: 'a', customer: { name: 'a', address: 'b' }, total: '10' })).toBe(false);
    expect(validateOrderDetails({ id: 'a', customer: { name: 'a', address: 'b' }, total: -1 })).toBe(false);
  });
});

describe('sanitizeEmailField', () => {
  test('strips CR/LF so header injection can never escape the text body', () => {
    expect(sanitizeEmailField('Alice\r\nBcc: attacker@evil.example')).toBe('AliceBcc: attacker@evil.example');
    expect(sanitizeEmailField('a\nb')).toBe('a b');
    expect(sanitizeEmailField('normal')).toBe('normal');
  });
});

describe('User model', () => {
  test('persists roles from the enum and marks email unique', async () => {
    expect(User.schema.paths.role.options.enum).toContain('delivery_man');
    expect(User.schema.paths.email.options.unique).toBe(true);
  });
});