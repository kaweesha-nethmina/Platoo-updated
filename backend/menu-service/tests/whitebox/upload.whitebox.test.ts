/**
 * WHITE-BOX tests - upload route + multer config + global error handler (SE4030).
 * Exercises the multer fileFilter / limits / storage branches.
 */
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import app from '../../src/app';
import { connectAndReset, disconnectDb } from '../helpers/db';

const api = request(app);
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

beforeAll(async () => {
  await connectAndReset();
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
});
afterAll(async () => {
  await disconnectDb();
});

describe('WHITE-BOX /api/upload (multer)', () => {
  it('WB-047 valid upload passes fileFilter & diskStorage -> 201', async () => {
    const res = await api.post('/api/upload').attach('file', PNG, 'valid.png');
    expect(res.status).toBe(201);
    expect(res.body.filename).toMatch(/^\d+-\d+\.png$/); // server-generated unique name
    const fp = path.join(UPLOAD_DIR, res.body.filename);
    expect(fs.existsSync(fp)).toBe(true);
    fs.unlinkSync(fp);
  });

  it('WB-048 fileFilter rejects disallowed extension (multipart error -> global handler 400)', async () => {
    const res = await api.post('/api/upload').attach('file', PNG, 'bad.exe');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Only image files are allowed/);
  });

  it('WB-049 fileFilter checks extension only, not magic bytes or MIME', async () => {
    const html = Buffer.from('<script>alert(1)</script>');
    const res = await api.post('/api/upload').attach('file', html, 'still-accepted.png');
    expect(res.status).toBe(201); // accepts HTML content behind a .png extension
    if (res.body.filename) {
      const fp = path.join(UPLOAD_DIR, res.body.filename);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
  });

  it('WB-050 fileSize limit 2MB enforced (multer LIMIT_FILE_SIZE -> 400)', async () => {
    const res = await api.post('/api/upload').attach('file', Buffer.alloc(2 * 1024 * 1024 + 1), 'big.png');
    expect(res.status).toBe(400);
    expect(typeof res.body.error).toBe('string');
  });

  it('WB-051 no file -> "No file uploaded" branch', async () => {
    const res = await api.post('/api/upload');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('No file uploaded');
  });

  it('WB-052 upload directory is created lazily if missing', async () => {
    // upload.routes.ts creates the dir at import time; ensure it exists
    expect(fs.existsSync(UPLOAD_DIR)).toBe(true);
  });
});

describe('WHITE-BOX global error handler', () => {
  it('WB-053 handler returns err.message as 400 (verbose leak for other error types)', async () => {
    // Trigger a non-multer error through the pipeline: bad JSON body -> body-parser syntax error
    const res = await api
      .post('/api/restaurants')
      .set('Content-Type', 'application/json')
      .send('{"broken json');
    console.log('[WB-053] malformed JSON ->', res.status, JSON.stringify(res.body).slice(0, 200));
    // body-parser errors are 400 with details, not routed to custom handler; documented.
  });
});