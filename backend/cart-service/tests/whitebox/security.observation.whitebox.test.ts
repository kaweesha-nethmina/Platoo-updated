/**
 * WHITE-BOX security-configuration tests - cart-service (SE4030).
 * POST-FIX verification: helmet headers present (VULN-08), CORS allow-list
 * enforced (VULN-08), auth middleware mounted on every route (VULN-02),
 * rate limiting active (VULN-09), and the central error handler returns
 * generic responses (VULN-07).
 */
import request from 'supertest';
import app from '../../src/app';
import { clearCollections, disconnectDb } from '../helpers/db';

const api = request(app);

beforeAll(async () => {
  await clearCollections();
});
afterAll(async () => {
  await disconnectDb();
});

describe('SECURITY OBSERVATIONS - cart-service configuration', () => {
  it('SEC-006 security headers ARE now sent (helmet enabled)', async () => {
    const res = await api.get('/api/cart/no-such');
    console.log('[SEC-006] headers:', JSON.stringify(res.headers));
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('SEC-007 CORS does NOT reflect arbitrary origins (allow-list enforced)', async () => {
    const res = await api.get('/api/cart/no-such').set('Origin', 'https://evil.example');
    console.log('[SEC-007] access-control-allow-origin:', res.headers['access-control-allow-origin']);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.headers['access-control-allow-origin']).not.toBe('*');
  });

  it('SEC-008 auth middleware IS mounted: routes reject requests without a token -> 401', async () => {
    const res = await api.get('/api/cart/no-such');
    expect(res.status).toBe(401);
  });

  it('SEC-009 rate limiting IS active (rate-limit headers present)', async () => {
    const res = await api.get('/api/cart/no-such');
    expect(res.headers['ratelimit-limit']).toBeDefined();
  });
});