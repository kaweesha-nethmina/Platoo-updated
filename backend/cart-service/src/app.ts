import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cartRoutes from './routes/cartRoutes';
import connectDB from './utils/db';
import { errorHandler } from './middlewares/errorHandler'; // [FIX VULN-07]

const app = express();

app.disable('x-powered-by'); // [FIX VULN-08]
app.use(helmet()); // [FIX VULN-08] security headers — WAS: none

// [FIX VULN-08] CORS allow-list — WAS: permissive cors().
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

// Middleware
app.use(bodyParser.json());

// Routes
app.use('/api/cart', cartRoutes);

// [FIX VULN-07] central error handler registered last (malformed JSON /
// ValidationError / unexpected errors -> typed generic responses, no leak).
app.use(errorHandler);

// Connect to database
connectDB();

export default app;