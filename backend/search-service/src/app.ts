import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import searchRoutes from './routes/search.routes';

const app = express();

// SRCH-07: remove the X-Powered-By fingerprint and add standard security
// headers (CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy...).
app.disable('x-powered-by');
app.use(helmet());

// SRCH-06: wildcard CORS (`Access-Control-Allow-Origin: *`) let any website
// read responses. Allow-list origins (default localhost:3000); unknown origins
// get no ACAO header so browsers block the read.
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
  })
);
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