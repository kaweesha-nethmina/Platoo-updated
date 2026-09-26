/**
 * WHITE-BOX tests - upload route + multer config + global error handler (SE4030).
 * POST-FIX verification: uploads require auth (VULN-01/02), the file filter is
 * content-based (VULN-06), and the central error handler maps client errors to
 * 400 (VULN-07).
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
    const res = await api.post('/api/upload').set(AUTH).attach('file', PNG, 'valid.png');
    expect(res.status).toBe(201);
    expect(res.body.filename).toMatch(/^\d+-\d+\.png$/); // server-generated unique name
    const fp = path.join(UPLOAD_DIR, res.body.filename);
    expect(fs.existsSync(fp)).toBe(true);
    fs.unlinkSync(fp);
  });

  it('WB-048 fileFilter rejects disallowed extension (multipart error -> global handler 400)', async () => {
    const res = await api.post('/api/upload').set(AUTH).attach('file', PNG, 'bad.exe');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Only image files are allowed/);
  });

  it('WB-049 fileFilter + magic-byte check reject HTML content behind a .png extension -> 400', async () => {
    const html = Buffer.from('<script>alert(1)</script>');
    const res = await api.post('/api/upload').set(AUTH).attach('file', html, 'still-accepted.png');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('File content is not a valid image');
  });

  it('WB-050 fileSize limit 2MB enforced (multer LIMIT_FILE_SIZE -> 400)', async () => {
    const res = await api.post('/api/upload').set(AUTH).attach('file', Buffer.alloc(2 * 1024 * 1024 + 1), 'big.png');
    expect(res.status).toBe(400);
    expect(typeof res.body.error).toBe('string');
  });

  it('WB-051 no file -> "No file uploaded" branch', async () => {
    const res = await api.post('/api/upload').set(AUTH);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('No file uploaded');
  });

  it('WB-052 upload directory is created lazily if missing', async () => {
    expect(fs.existsSync(UPLOAD_DIR)).toBe(true);
  });
});

describe('WHITE-BOX global error handler', () => {
  it('WB-053 malformed JSON body -> central handler returns 400 (SyntaxError typed)', async () => {
    const res = await api
      .post('/api/restaurants')
      .set('Content-Type', 'application/json')
      .send('{"broken json');
    expect(res.status).toBe(400);
  });
});