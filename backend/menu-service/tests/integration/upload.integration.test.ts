/**
 * INTEGRATION tests - menu-service POST /api/upload (multer) (SSD / QA).
 * Full request/response cycle against the real app + real filesystem writes to
 * process.cwd()/uploads. Created files are removed in afterEach/afterAll so no
 * leftovers remain. Test-case IDs: INT-M-UP-###
 */
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import app from '../../src/app';
import { connectAndReset, clearCollections, disconnectDb } from '../helpers/db';

const api = request(app);

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

const createdFiles: string[] = [];

const cleanupFiles = () => {
  while (createdFiles.length) {
    const name = createdFiles.pop() as string;
    const fp = path.join(UPLOAD_DIR, name);
    if (fs.existsSync(fp)) {
      fs.unlinkSync(fp);
    }
  }
};

const log = (id: string, scenario: string, status: number, body: unknown) => {
  console.log(
    `[INT-M-UP-${id}] ${scenario} -> status=${status} body=${JSON.stringify(body).slice(0, 160)}`
  );
};

beforeAll(async () => {
  await connectAndReset();
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
});

afterEach(() => {
  cleanupFiles();
});

afterAll(async () => {
  cleanupFiles();
  await disconnectDb();
});

describe('INTEGRATION /api/upload', () => {
  it('INT-M-UP-001 success: valid PNG -> 201 with url + filename (SPEC: 201)', async () => {
    const res = await api.post('/api/upload').attach('file', PNG_1x1, 'menu-item.png');
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('url');
    expect(res.body).toHaveProperty('filename');
    expect(res.body.url).toMatch(/^http:\/\/.*\/uploads\/\d+-\d+\.png$/);
    if (res.body.filename) createdFiles.push(res.body.filename);
  });

  it('INT-M-UP-002 success: case-insensitive extension (.JPG) -> 201', async () => {
    const res = await api.post('/api/upload').attach('file', PNG_1x1, 'PHOTO.JPG');
    expect(res.status).toBe(201);
    expect(res.body.filename).toMatch(/\.jpg$/);
    if (res.body.filename) createdFiles.push(res.body.filename);
  });

  it('INT-M-UP-003 validation: NO file -> 400 "No file uploaded" (SPEC: 400)', async () => {
    const res = await api.post('/api/upload');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'No file uploaded' });
  });

  it('INT-M-UP-004 validation: disallowed extension (.exe) -> 400 filter message (SPEC: 400)', async () => {
    const res = await api.post('/api/upload').attach('file', Buffer.from('MZ...'), 'virus.exe');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Only image files are allowed (png, jpg, jpeg, gif, webp)');
  });

  it('INT-M-UP-005 validation: disallowed extension (.html) -> 400 (SPEC: 400)', async () => {
    const res = await api.post('/api/upload').attach('file', Buffer.from('<html>'), 'page.html');
    log('005', 'html upload', res.status, res.body);
    expect(res.status).toBe(400);
  });

  it('INT-M-UP-006 validation: oversized file (>2MB) -> 400 "File too large" (multer limit) (SPEC: 400)', async () => {
    const big = Buffer.alloc(3 * 1024 * 1024, 1);
    const res = await api.post('/api/upload').attach('file', big, 'big.png');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('File too large');
  });

  it('INT-M-UP-007 boundary: file exactly at 2MB -> 201 accepted', async () => {
    const exact = Buffer.alloc(2 * 1024 * 1024);
    const res = await api.post('/api/upload').attach('file', exact, 'exact.png');
    expect(res.status).toBe(201);
    if (res.body.filename) createdFiles.push(res.body.filename);
  });

  it('INT-M-UP-008 validation: unexpected field name -> 400 (LIMIT_UNEXPECTED_FILE)', async () => {
    const res = await api.post('/api/upload').attach('wrongField', PNG_1x1, 'photo.png');
    log('008', 'wrong field', res.status, res.body);
    expect(res.status).toBe(400);
  });

  it('INT-M-UP-009 auth-gap: upload without any auth token succeeds -> 201; token is NOT enforced', async () => {
    const res = await api.post('/api/upload').attach('file', PNG_1x1, 'fries.png');
    log('009', 'no auth upload', res.status, res.body && { url: res.body.url });
    expect(res.status).toBe(201);
    if (res.body.filename) createdFiles.push(res.body.filename);
  });

  it('INT-M-UP-010 security: path-traversal client filename is neutralised (server random name, no "..")', async () => {
    const res = await api.post('/api/upload').attach('file', PNG_1x1, '../../../../evil.png');
    expect(res.status).toBe(201);
    expect(res.body.filename).not.toContain('..');
    if (res.body.filename) createdFiles.push(res.body.filename);
  });

  it('INT-M-UP-011 security: HTML content smuggled inside .png (extension-only filter) is ACCEPTED (documented gap)', async () => {
    const html = Buffer.from('<html><script>alert(1)</script></html>');
    const res = await api.post('/api/upload').attach('file', html, 'smuggled.png');
    log('011', 'html-in-png', res.status, res.body && { filename: res.body.filename });
    expect(res.status).toBe(201); // MIME is never validated
    if (res.body.filename) createdFiles.push(res.body.filename);
  });
});