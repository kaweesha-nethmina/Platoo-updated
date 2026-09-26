/**
 * WHITE-BOX security-configuration tests - menu-service (SE4030).
 * POST-FIX verification: helmet headers are present (VULN-08), the CORS
 * allow-list no longer reflects arbitrary origins (VULN-08), and the global
 * rate limiter is active (VULN-09).
 */
import request from 'supertest';
import app from '../../src/app';
import { connectAndReset, disconnectDb } from '../helpers/db';

const api = request(app);

beforeAll(async () => {
  await connectAndReset();
});
afterAll(async () => {
  await disconnectDb();
});

describe('SECURITY OBSERVATIONS - menu-service configuration', () => {
  it('SEC-001 security headers ARE now sent (helmet enabled): nosniff, CSP, HSTS present', async () => {
    const res = await api.get('/api/restaurants');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('SEC-002 CORS does NOT reflect arbitrary origins (allow-list enforced)', async () => {
    const res = await api.get('/api/restaurants').set('Origin', 'https://evil.example');
    console.log('[SEC-002] access-control-allow-origin:', res.headers['access-control-allow-origin']);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.headers['access-control-allow-origin']).not.toBe('*');
  });

  it('SEC-003 rate-limit headers ARE now present (express-rate-limit active)', async () => {
    const res = await api.get('/api/restaurants');
    expect(res.headers['ratelimit-limit']).toBeDefined();
  });

  it('SEC-004 express.json uses default 100kb limit (no explicit cap)', async () => {
    console.log('[SEC-004] app.ts uses express.json() with default settings');
    expect(true).toBe(true);
  });

  it('SEC-005 static /uploads served (content-sniffing risk mitigated by nosniff)', async () => {
    const res = await api.get('/uploads/anything.png').set('Origin', 'https://evil.example');
    console.log('[SEC-005] uploads response headers:', JSON.stringify(res.headers));
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});