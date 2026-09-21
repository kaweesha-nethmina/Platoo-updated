/**
 * SEARCH-SERVICE - BLACK BOX tests (target-state assertions).
 * Tests run over HTTP against the live service, exactly as an external
 * attacker/user would see it. Several assertions describe the *secure*
 * behaviour and therefore FAIL on the original code and PASS after the
 * hardening fix (see docs/security/SEARCH-SERVICE-SECURITY-README.md).
 */
import request from 'supertest';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3002';

jest.setTimeout(60000);

const get = (path: string) => request(BASE).get(path);

describe('search-service black box', () => {
  describe('functional correctness', () => {
    test('valid search returns 200 with a JSON array', async () => {
      const res = await get('/api/restaurants?query=pizza');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    test('no parameters returns 400 and a JSON body (no stack trace)', async () => {
      const res = await get('/api/restaurants');
      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toContain('application/json');
      expect(JSON.stringify(res.body)).not.toContain('node_modules');
      expect(JSON.stringify(res.body)).not.toContain('at ');
    });

    test('unicode query is handled without a 500', async () => {
      const res = await get('/api/restaurants?query=' + encodeURIComponent('පීසා'));
      expect(res.status).not.toBe(500);
    });
  });

  describe('NoSQL operator injection', () => {
    // Before fix: objects such as {$ne:...}/{$gt:...} reach the $regex and
    // the request crashes with 500 (verified). After fix: 400 JSON.
    test('query[$ne] operator is rejected, not executed', async () => {
      const res = await get('/api/restaurants?query%5B%24ne%5D=pizza');
      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toContain('application/json');
    });

    test('query[$gt] operator is rejected', async () => {
      const res = await get('/api/restaurants?query%5B%24gt%5D=a');
      expect(res.status).toBe(400);
    });

    test('cuisine[$ne] operator is rejected', async () => {
      const res = await get('/api/restaurants?cuisine%5B%24ne%5D=italian');
      expect(res.status).toBe(400);
    });

    test('location[$regex] operator is rejected', async () => {
      const res = await get('/api/restaurants?location%5B%24regex%5D=%5E.*');
      expect(res.status).toBe(400);
    });
  });

  describe('regex / ReDoS hygiene', () => {
    test('regex metacharacters query does not crash nor return a stack trace', async () => {
      const res = await get('/api/restaurants?query=' + encodeURIComponent('(a+)+$'));
      expect([200, 400]).toContain(res.status);
      expect(JSON.stringify(res.body)).not.toContain('node_modules');
      expect(JSON.stringify(res.body)).not.toContain('at MongooseError');
    });

    test('catastrophic pattern stays fast (no catastrophic backtracking blow-up)', async () => {
      const start = Date.now();
      const res = await get('/api/restaurants?query=' + encodeURIComponent('(a+)+$'));
      const elapsed = Date.now() - start;
      expect([200, 400]).toContain(res.status);
      expect(elapsed).toBeLessThan(5000);
    });
  });

  describe('resource usage / pagination', () => {
    test('a broad query is bounded in size (pagination enforced)', async () => {
      const res = await get('/api/restaurants?query=.');
      expect(res.status).toBe(200);
      const bytes = JSON.stringify(res.body).length;
      expect(bytes).toBeLessThan(2_000_000);
    });

    test('huge limit value is capped', async () => {
      const res = await get('/api/restaurants?query=pizza&limit=999999999');
      expect(res.status).toBe(200);
      expect(res.body.length).toBeLessThanOrEqual(100);
    });

    test('negative limit is treated safely (no crash)', async () => {
      const res = await get('/api/restaurants?query=pizza&limit=-1');
      expect(res.status).not.toBe(500);
    });

    test('non-numeric page is ignored safely', async () => {
      const res = await get('/api/restaurants?query=pizza&page=abc');
      expect(res.status).not.toBe(500);
    });
  });

  describe('rate limiting', () => {
    test('rate limit headers are present', async () => {
      const res = await get('/api/restaurants?query=pizza');
      expect(res.headers['x-ratelimit-limit']).toBeDefined();
      expect(res.headers['x-ratelimit-remaining']).toBeDefined();
    });

    test('excessive requests are throttled with 429', async () => {
      // fire 30 quick requests; some must be throttled
      const codes: number[] = [];
      for (let i = 0; i < 30; i += 1) {
        const r = await get('/api/restaurants?query=pizza');
        codes.push(r.status);
      }
      expect(codes).toContain(429);
    });
  });

  describe('security headers / hardening', () => {
    test('X-Powered-By header is removed', async () => {
      const res = await get('/api/restaurants?query=pizza');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    test('helmet security headers present', async () => {
      const res = await get('/api/restaurants?query=pizza');
      expect(res.headers['content-security-policy']).toBeDefined();
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBeDefined();
      expect(res.headers['referrer-policy']).toBeDefined();
    });

    test('CORS does not reflect arbitrary origins', async () => {
      const res = await get('/api/restaurants?query=pizza').set('Origin', 'https://evil.example');
      const acao = String(res.headers['access-control-allow-origin'] || '');
      expect(acao).not.toBe('*');
      expect(acao).not.toBe('https://evil.example');
    });
  });

  describe('error handling', () => {
    test('oversized POST body returns JSON error, not an HTML stack trace', async () => {
      const big = '{"x":"' + 'a'.repeat(300000) + '"}';
      const res = await request(BASE)
        .post('/api/restaurants')
        .set('Content-Type', 'application/json')
        .send(big);
      expect(res.status).toBe(413);
      expect(res.headers['content-type']).toContain('application/json');
      const body = JSON.stringify(res.body);
      expect(body).not.toContain('node_modules');
      expect(body).not.toContain('PayloadTooLargeError');
    });

    test('method tampering returns 40x without stack traces', async () => {
      const res = await request(BASE).post('/api/restaurants').send({});
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
      expect(JSON.stringify(res.body)).not.toContain('node_modules');
    });
  });
});