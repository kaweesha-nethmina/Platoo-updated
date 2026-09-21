import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import searchRoutes from './routes/search.routes';

const app = express();

app.use(cors());
app.use(express.json());

// SRCH-04: the public search API was unauthenticated and unthrottled; 50 quick
// requests dropped throughput to 1.7 req/s. Throttle per IP. Configurable so
// the black-box suite can prove 429 deterministically (RATE_LIMIT_MAX=20).
app.use(
  rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000),
    limit: Number(process.env.RATE_LIMIT_MAX || 20),
    standardHeaders: true,
    legacyHeaders: true,
    message: { error: 'Too many requests, please slow down' },
  })
);

// Routes
app.use('/api', searchRoutes);

// JSON 404 for unknown routes.
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});

// Keep 500 responses JSON (stack traces are never sent to the client).
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err) console.error('[search-service] unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

export default app;