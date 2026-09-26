import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import restaurantRoutes from './routes/restaurant.routes';
import menuItemRoutes from './routes/menuItem.routes';
import categoryRoutes from './routes/category.routes';
import uploadRoutes from './routes/upload.routes';
import { requireAuth } from './middleware/auth'; // [FIX VULN-01]
import cors from 'cors';

const app = express();

app.disable('x-powered-by'); // [FIX VULN-08] WAS: X-Powered-By: Express header leaked

// [FIX VULN-08] security headers (CSP, X-Content-Type-Options: nosniff,
// HSTS, Permissions-Policy, ...) — WAS: none (ZAP 10037/10055/10063/10098).
app.use(helmet());

// [FIX VULN-08] CORS allow-list — WAS: permissive cors() reflecting any origin.
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') ?? false, credentials: true }));

// [FIX VULN-09] global per-IP rate limit — WAS: no rate limiting at all.
app.use(
  rateLimit({
    windowMs: 60_000,
    max: Number(process.env.RATE_LIMIT_MAX) || 100,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use(express.json());

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// [FIX VULN-01] upload router is write-only -> requireAuth mounted here.
app.use('/api/upload', requireAuth, uploadRoutes);

// [FIX VULN-01] write endpoints on the other routers also require a valid
// HS256 token (requireAuth is applied to the mutation routes in each router file).
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/category', categoryRoutes);
app.use('/api/menu-items', menuItemRoutes);

// [FIX VULN-07] central error handler — WAS: always 400 + leaked err.message.
// Now returns 400 for client input errors (Validation/Cast/Syntax) and a
// generic 500 otherwise; details are only revealed outside production.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error & { name?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const isClientErr =
    ['ValidationError', 'CastError', 'SyntaxError', 'MulterError'].includes(err.name ?? '') ||
    (err as any)?.status === 400;
  res.status(isClientErr ? 400 : 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Request failed' : (err.message ?? 'Unknown error'),
  });
});

export default app;