/**
 * UNIT tests - menu-service POST /api/upload multer configuration.
 * Filesystem is MOCKED (jest.mock('fs')): the disk-storage engine's writes
 * are intercepted via createWriteStream so NOTHING touches real disk,
 * networking, or the database. Confirms the real multer config used by
 * src/routes/upload.routes.ts (allowed extensions + 2 MB size limit + the
 * generated filename scheme) without any app-code changes.
 */
import { Writable } from 'stream';

jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs') as typeof import('fs');
  return {
    ...actualFs,
    createWriteStream: jest.fn(
      () => new Writable({ write(_chunk, _enc, cb) { cb(); } })
    ),
  };
});

import fs from 'fs';
import request from 'supertest';
import app from '../../src/app';

const mockCreateWriteStream = fs.createWriteStream as jest.Mock;

const api = request(app);

describe('POST /api/upload (multer config, fs mocked)', () => {
  beforeEach(() => {
    mockCreateWriteStream.mockClear();
  });

  it('UNIT-M-UP-001 no file attached → 400 "No file uploaded"', async () => {
    const res = await api.post('/api/upload');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'No file uploaded' });
    expect(mockCreateWriteStream).not.toHaveBeenCalled();
  });

  it('UNIT-M-UP-002 valid .png → 201 { url, filename } and exactly one intercepted write', async () => {
    const res = await api
      .post('/api/upload')
      .attach('file', Buffer.from([0x89, 0x50, 0x4e, 0x47]), 'menu-item.png');

    expect(res.status).toBe(201);
    expect(res.body.url).toMatch(/^https?:\/\/.+\/uploads\/.+\.png$/);
    expect(res.body.filename).toMatch(/^\d+-\d+\.png$/);
    expect(mockCreateWriteStream).toHaveBeenCalledTimes(1);
    expect(mockCreateWriteStream.mock.calls[0][0]).toMatch(/uploads[/\\]\d+-\d+\.png$/);
  });

  it('UNIT-M-UP-003 filename is <timestamp>-<random>.<ext> (Date.now/Math.random deterministic)', async () => {
    const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(1710000000000);
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
    try {
      const res = await api
        .post('/api/upload')
        .attach('file', Buffer.from('x'), 'dish.jpg');

      expect(res.status).toBe(201);
      expect(res.body.filename).toBe('1710000000000-500000000.jpg');
      expect(mockCreateWriteStream.mock.calls[0][0]).toMatch(/uploads[/\\]1710000000000-500000000\.jpg$/);
    } finally {
      dateSpy.mockRestore();
      randomSpy.mockRestore();
    }
  });

  it('UNIT-M-UP-004 allowed extensions are case-insensitive (PHOTO.JPG accepted, stored lowercase ext)', async () => {
    const res = await api
      .post('/api/upload')
      .attach('file', Buffer.from('x'), 'PHOTO.JPG');
    expect(res.status).toBe(201);
    expect(res.body.filename).toMatch(/\.jpg$/);
  });

  it('UNIT-M-UP-005 rejected extension (.exe) → 400 filter message, write never happens', async () => {
    const res = await api
      .post('/api/upload')
      .attach('file', Buffer.from('MZ...'), 'virus.exe');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Only image files are allowed (png, jpg, jpeg, gif, webp)');
    expect(mockCreateWriteStream).not.toHaveBeenCalled();
  });

  it('UNIT-M-UP-006 rejected extension (.html) → 400, no persistence', async () => {
    const res = await api
      .post('/api/upload')
      .attach('file', Buffer.from('<script>alert(1)</script>'), 'page.html');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Only image files are allowed');
  });

  it('UNIT-M-UP-007 empty extension → rejected (path.extname("") is not allowed)', async () => {
    const res = await api
      .post('/api/upload')
      .attach('file', Buffer.from('x'), 'noext');
    expect(res.status).toBe(400);
  });

  it('UNIT-M-UP-008 SECURITY NOTE: validation is extension-only, MIME is ignored (text/plain masquerading as .png accepted)', async () => {
    const res = await api
      .post('/api/upload')
      .attach('file', Buffer.from('not-an-image-at-all'), { filename: 'fake.png', contentType: 'text/plain' });
    expect(res.status).toBe(201); // documented behavioural gap: MIME never checked
  });

  it('UNIT-M-UP-009 file larger than 2 MB → 400 "File too large" (LIMIT_FILE_SIZE)', async () => {
    const tooBig = Buffer.alloc(2 * 1024 * 1024 + 1024);
    const res = await api
      .post('/api/upload')
      .attach('file', tooBig, 'big.png');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('File too large');
  });

  it('UNIT-M-UP-010 file exactly at the 2 MB limit is accepted (boundary)', async () => {
    const exactly = Buffer.alloc(2 * 1024 * 1024);
    const res = await api
      .post('/api/upload')
      .attach('file', exactly, 'exact.png');
    expect(res.status).toBe(201);
  });

  it('UNIT-M-UP-011 unexpected field name → multer LIMIT_UNEXPECTED_FILE → 400 (handler only accepts "file")', async () => {
    const res = await api
      .post('/api/upload')
      .attach('wrongField', Buffer.from('x'), 'photo.png');
    expect(res.status).toBe(400);
  });
});