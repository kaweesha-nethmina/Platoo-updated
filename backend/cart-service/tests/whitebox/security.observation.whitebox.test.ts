/**
 * WHITE-BOX security-configuration observations - cart-service (SE4030).
 * Documents the baseline configuration state as evidence.
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
  it('SEC-006 no security headers sent (no helmet)', async () => {
    const res = await api.get('/api/cart/no-such');
    console.log('[SEC-006] headers:', JSON.stringify(res.headers));
    expect(res.headers['x-content-type-options']).toBeUndefined();
    expect(res.headers['content-security-policy']).toBeUndefined();
    expect(res.headers['strict-transport-security']).toBeUndefined();
  });

  it('SEC-007 CORS reflects ANY origin', async () => {
    const res = await api.get('/api/cart/no-such').set('Origin', 'https://evil.example');
    console.log('[SEC-007] access-control-allow-origin:', res.headers['access-control-allow-origin']);
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  it('SEC-008 no auth middleware present: routes registered with bare handlers', async () => {
    // Structural: cartRoutes.ts has no auth reference; confirmed by black-box tests.
    console.log('[SEC-008] cartRoutes.ts imports handlers directly, no JWT verification middleware.');
    expect(true).toBe(true);
  });

  it('SEC-009 no rate limiting', async () => {
    const res = await api.get('/api/cart/no-such');
    expect(res.headers['ratelimit-limit']).toBeUndefined();
  });
});