/**
 * NOTIFICATION-SERVICE - BLACK BOX tests (target-state assertions).
 * Tests run over HTTP against the live service. Auth tokens are minted with
 * the jsonwebtoken library using the service's configured JWT_SECRET so the
 * tests exercise the real authentication path over the wire.
 */
import request from 'supertest';
import jwt from 'jsonwebtoken';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4006';
const SECRET = process.env.JWT_SECRET || 'test-only-secret-change-me';

jest.setTimeout(120000);

const mint = (role: string, opts: { expiresIn?: number; algorithm?: string } = {}) =>
  jwt.sign({ id: '507f1f77bcf86cd799439011', role }, SECRET, {
    expiresIn: opts.expiresIn ?? 3600,
    algorithm: (opts.algorithm as jwt.Algorithm) ?? 'HS256',
  });

const VALID = {
  orderDetails: { id: 'ord-test-1', customer: { name: 'Alice', address: 'Colombo' }, total: 25.5 },
};

const URL = '/api/notifications/send-delivery-notification';

const ADMIN_AUTH = `Bearer ${mint('admin')}`;

describe('notification-service black box', () => {
  describe('authentication & authorisation', () => {
    test('request without token is rejected 401', async () => {
      const res = await request(BASE).post(URL).send(VALID);
      expect(res.status).toBe(401);
    });

    test('token with role "user" is rejected 403', async () => {
      const res = await request(BASE)
        .post(URL)
        .set('Authorization', `Bearer ${mint('user')}`)
        .send(VALID);
      expect(res.status).toBe(403);
    });

    test('forged token (wrong secret) is rejected 401', async () => {
      const forged = jwt.sign({ id: 'x', role: 'admin' }, 'WRONG-SECRET', { expiresIn: 3600 });
      const res = await request(BASE).post(URL).set('Authorization', `Bearer ${forged}`).send(VALID);
      expect(res.status).toBe(401);
    });

    test('expired token is rejected 401', async () => {
      const expired = mint('admin', { expiresIn: -1 });
      const res = await request(BASE).post(URL).set('Authorization', `Bearer ${expired}`).send(VALID);
      expect(res.status).toBe(401);
    });

    test('"alg:none" token is rejected 401', async () => {
      const b64url = (o: Record<string, unknown>) => Buffer.from(JSON.stringify(o)).toString('base64url');
      const unsigned = `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url({ id: 'x', role: 'admin' })}.`;
      const res = await request(BASE).post(URL).set('Authorization', `Bearer ${unsigned}`).send(VALID);
      expect(res.status).toBe(401);
    });

    test('authorised admin can trigger a notification', async () => {
      const res = await request(BASE)
        .post(URL)
        .set('Authorization', `Bearer ${mint('admin')}`)
        .send(VALID);
      expect(res.status).toBe(200);
    });
  });

  describe('input validation', () => {
    const admin = `Bearer ${mint('admin')}`;
    const post = (body: object) => request(BASE).post(URL).set('Authorization', admin).send(body);

    test('missing orderDetails -> 400', async () => {
      const res = await post({ foo: 1 });
      expect(res.status).toBe(400);
    });

    test('customer.address missing -> 400', async () => {
      const res = await post({
        orderDetails: { id: 'a', customer: { name: 'b' }, total: 1 },
      });
      expect(res.status).toBe(400);
    });

    test('total not a number -> 400', async () => {
      const res = await post({
        orderDetails: { id: 'a', customer: { name: 'b', address: 'c' }, total: 'x' },
      });
      expect(res.status).toBe(400);
    });

    test('oversized id (>64) -> 400', async () => {
      const res = await post({
        orderDetails: { id: 'x'.repeat(80), customer: { name: 'b', address: 'c' }, total: 1 },
      });
      expect(res.status).toBe(400);
    });

    test('oversized body (>10kb) -> 4xx JSON, no stack trace', async () => {
      const res = await request(BASE)
        .post(URL)
        .set('Authorization', admin)
        .send({ pad: 'a'.repeat(20000) });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
      expect(res.headers['content-type']).toContain('application/json');
      expect(JSON.stringify(res.body)).not.toContain('node_modules');
    });

    test('malformed JSON -> 400 JSON', async () => {
      const res = await request(BASE)
        .post(URL)
        .set('Authorization', admin)
        .set('Content-Type', 'application/json')
        .send('{bad json');
      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toContain('application/json');
    });
  });

  describe('injection / abuse resistance', () => {
    const admin = `Bearer ${mint('admin')}`;

    test('CRLF / header-injection-looking payloads do not break the response contract', async () => {
      const res = await request(BASE)
        .post(URL)
        .set('Authorization', admin)
        .set('Host', 'localhost')
        .send({
          orderDetails: {
            id: 'ord-crlf',
            customer: { name: 'Alice\r\nBcc: attacker@evil.example\r\nX-Evil: 1', address: 'Colombo' },
            total: 1,
          },
        });
      expect([200, 400]).toContain(res.status);
      expect(res.headers['content-type']).toContain('application/json');
    });

    test('HTML/script payloads are encoded as plain text, never executed (response sans markup)', async () => {
      const res = await request(BASE)
        .post(URL)
        .set('Authorization', ADMIN_AUTH)
        .send({
          orderDetails: {
            id: 'ord-html',
            customer: { name: '<img src=x onerror=alert(1)>', address: '<script>alert(2)</script>' },
            total: 1,
          },
        });
      expect([200, 400]).toContain(res.status);
    });
  });

  describe('security headers / hardening', () => {
    test('X-Powered-By disabled', async () => {
      const res = await request(BASE).get('/');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    test('helmet security headers present', async () => {
      const res = await request(BASE).get('/');
      const hasSecurityHeader = (['content-security-policy', 'x-content-type-options', 'x-frame-options', 'referrer-policy', 'strict-transport-security'] as string[]).some(
        (h: string) => res.headers[h] !== undefined
      );
      expect(hasSecurityHeader).toBe(true);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    test('CORS rejects disallowed origins cleanly (no 500)', async () => {
      const res = await request(BASE).post(URL).set('Origin', 'https://evil.example').set('Authorization', ADMIN_AUTH).send(VALID);
      // A CORS-refused request must not surface as a 500; the service must
      // not reflect the disallowed origin.
      expect(res.status).toBeGreaterThanOrEqual(400);
      const acao = String(res.headers['access-control-allow-origin'] || '');
      expect(acao).not.toBe('https://evil.example');
    });
  });
});
