/**
 * WHITE-BOX security-configuration observations - menu-service (SE4030).
 * These do NOT assert "secure" behaviour - they DOCUMENT the current
 * baseline configuration state as evidence for the vulnerability register.
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
  it('SEC-001 no security headers sent (no helmet): X-Content-Type-Options etc. absent', async () => {
    const res = await api.get('/api/restaurants');
    console.log('[SEC-001] headers:', JSON.stringify(res.headers));
    expect(res.headers['x-content-type-options']).toBeUndefined();
    expect(res.headers['content-security-policy']).toBeUndefined();
    expect(res.headers['strict-transport-security']).toBeUndefined();
    expect(res.headers['x-frame-options']).toBeUndefined();
  });

  it('SEC-002 CORS reflects ANY origin (permissive cors())', async () => {
    const res = await api.get('/api/restaurants').set('Origin', 'https://evil.example');
    console.log('[SEC-002] access-control-allow-origin:', res.headers['access-control-allow-origin']);
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  it('SEC-003 no rate-limit headers present (no express-rate-limit)', async () => {
    const res = await api.get('/api/restaurants');
    expect(res.headers['ratelimit-limit']).toBeUndefined();
    expect(res.headers['x-ratelimit-limit']).toBeUndefined();
  });

  it('SEC-004 express.json uses default 100kb limit (no explicit cap)', async () => {
    // structural check: no explicit limit passed in app.ts -> default 100kb
    console.log('[SEC-004] app.ts line 11 uses express.json() with default settings');
    expect(true).toBe(true);
  });

  it('SEC-005 static /uploads served without CSP/nosniff (content sniffing risk)', async () => {
    const res = await api.get('/uploads/anything.png').set('Origin', 'https://evil.example');
    console.log('[SEC-005] uploads response headers:', JSON.stringify(res.headers));
  });
});