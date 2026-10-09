import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import connectDB from './config/database'; // No need for .ts in this case
import orderRoutes from './routes/orderRoutes';

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// --- Security hardening -----------------------------------------------------

// Harden HTTP headers (X-Content-Type-Options, X-Frame-Options, CSP, etc.)
app.use(helmet());

// CORS is restricted to configured origins instead of the wildcard default.
// No-origin requests (curl, server-to-server) can still use the API.
const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://127.0.0.1:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    },
  })
);

// Cap the request body size so oversized payloads cannot exhaust memory.
app.use(express.json({ limit: '32kb' }));

// Fail fast when CORS rejects a request.
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err.message === 'Not allowed by CORS') {
    res.status(403).json({ message: 'Not allowed by CORS' });
    return;
  }
  next(err);
});

// Global budget for the whole order service (default 500 req / 15 min).
const globalWindowMs = Number(process.env.RATE_LIMIT_GLOBAL_WINDOW_MS ?? 15 * 60 * 1000);
const globalMax = Number(process.env.RATE_LIMIT_GLOBAL_MAX ?? 500);
app.use(
  rateLimit({
    windowMs: globalWindowMs,
    max: globalMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later.' },
    skipSuccessfulRequests: false,
  })
);

// Tighter budget for order creation: guards against automated price/order
// flooding while leaving headroom for normal usage (default 30 / minute).
const orderWindowMs = Number(process.env.RATE_LIMIT_ORDER_WINDOW_MS ?? 60 * 1000);
const orderMax = Number(process.env.RATE_LIMIT_ORDER_MAX ?? 30);
app.use(
  '/api/orders',
  rateLimit({
    windowMs: orderWindowMs,
    max: orderMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many order requests, please try again later.' },
  })
);

// Order routes
app.use('/api', orderRoutes);

// Central 404 + error handler (never leaks internals).
app.use((req, res) => {
  res.status(404).json({ message: 'Not found' });
});
// eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[order-service] unhandled error:', err instanceof Error ? err.stack : err);
  res.status(500).json({ message: 'Internal server error' });
});

const PORT = process.env.PORT || 3020;

const server = app.listen(PORT, () => {
  console.log(`Order service running on port ${PORT}`);
});

// Gracefully handle shutdown to release the port
process.on('SIGINT', () => {
  console.log("Gracefully shutting down...");
  server.close(() => {
    console.log("Closed server, freeing up port.");
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log("SIGTERM received, shutting down gracefully...");
  server.close(() => {
    console.log("Closed server after SIGTERM.");
    process.exit(0);
  });
});