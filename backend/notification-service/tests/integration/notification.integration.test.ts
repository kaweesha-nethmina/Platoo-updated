/**
 * NOTIFICATION-SERVICE - INTEGRATION tests.
 * Boots the real Express app against an in-memory MongoDB (mongodb-memory-server)
 * and a fully mocked SMTP transport, then drives HTTP with supertest.
 *
 * Env vars are pinned BEFORE the app module is required (jest.resetModules) so
 * that module-load-time reads (RATE_LIMIT_MAX, JWT_SECRET) use test values:
 * the rate limiter is lifted so the suite never sees a 429 and the JWT secret
 * matches the tokens we issue. No real email is ever sent.
 */
import type { Express } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';

const JWT_SECRET = 'integration-test-secret';

// Hoisted mock: transport factory -> sendMail jest.fn(). No real nodemailer.
const mockSendMail = jest.fn();
jest.mock('../../src/utils/transport', () => ({
  createTransport: jest.fn(() => ({ sendMail: mockSendMail })),
}));

// Captured from the SAME module registry as the app (see beforeAll) so the
// seeded users live in the same mongoose instance the service queries.
let mongoose: typeof import('mongoose');

describe('notification-service API (integration)', () => {
  let mongo: MongoMemoryServer;
  let app: Express;
  let UserModel: { create: (docs: unknown[]) => Promise<unknown> };

  const adminToken = () => jwt.sign({ id: 'actor-1', role: 'admin' }, JWT_SECRET, { algorithm: 'HS256' });
  const validBody = {
    orderDetails: { id: 'order-123', customer: { name: 'Alice', address: 'Colombo 06' }, total: 25 },
  };

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    const uri = mongo.getUri();

    process.env.MONGO_URI = uri;
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.RATE_LIMIT_MAX = '5000';
    process.env.RATE_LIMIT_WINDOW_MS = '60000';
    process.env.MAX_NOTIFICATION_RECIPIENTS = '50';
    process.env.SMTP_TRANSPORT = 'mock';
    process.env.EMAIL_USER = 'sender@test.local';

    mockSendMail.mockReset().mockResolvedValue({ messageId: 'test' });

    // Dynamic require AFTER env is set: module-load-time reads use test values,
    // and the same registry keeps a single mongoose + User model instance.
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mongoose = require('mongoose');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    UserModel = require('../../src/models/User').default;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    app = (require('../../src/app') as { default: Express }).default;

    await mongoose.connect(uri);
    // Seed delivery persons the service fans out to.
    await (UserModel.create as (docs: unknown[]) => Promise<unknown>)([
      { name: 'D1', email: 'd1@test.local', password: 'x', role: 'delivery_man' },
      { name: 'D2', email: 'd2@test.local', password: 'x', role: 'delivery_man' },
    ]);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    await mongo.stop();
    jest.resetModules();
  });

  describe('auth gate', () => {
    test('401 when no token is sent', async () => {
      const res = await request(app)
        .post('/api/notifications/send-delivery-notification')
        .send(validBody);
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Unauthorized: No token provided' });
    });

    test('401 for a garbage token', async () => {
      const res = await request(app)
        .post('/api/notifications/send-delivery-notification')
        .set('Authorization', 'Bearer not.a.real.token')
        .send(validBody);
      expect(res.status).toBe(401);
    });

    test('403 for a role outside admin/restaurant_owner', async () => {
      const token = jwt.sign({ id: 'u-1', role: 'delivery_man' }, JWT_SECRET, { algorithm: 'HS256' });
      const res = await request(app)
        .post('/api/notifications/send-delivery-notification')
        .set('Authorization', `Bearer ${token}`)
        .send(validBody);
      expect(res.status).toBe(403);
    });
  });

  describe('validation', () => {
    test('400 for a missing orderDetails', async () => {
      const res = await request(app)
        .post('/api/notifications/send-delivery-notification')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Invalid order details' });
    });

    test('400 for an invalid total', async () => {
      const res = await request(app)
        .post('/api/notifications/send-delivery-notification')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ orderDetails: { id: 'o1', customer: { name: 'A', address: 'B' }, total: -5 } });
      expect(res.status).toBe(400);
    });
  });

  describe('success path', () => {
    test('200, fans out to the seeded delivery persons, and never calls real SMTP', async () => {
      const res = await request(app)
        .post('/api/notifications/send-delivery-notification')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send(validBody);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        message: 'Notifications sent successfully',
        delivered: 2,
      });
      expect(mockSendMail).toHaveBeenCalledTimes(2);
      // Emails fan out concurrently (Promise.all), so order is not stable.
      const recipients = mockSendMail.mock.calls.map(([mailOptions]: Array<{ to: string }>) => mailOptions.to).sort();
      expect(recipients).toEqual(['d1@test.local', 'd2@test.local']);
      expect(mockSendMail.mock.calls[0][0].subject).toBe('New Delivery Order');
    });
  });
});