import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import notificationRoutes from './routes/notificationRoutes';
import { rateLimiter } from './middleware/rateLimiter';

const app = express();
dotenv.config();
const PORT = process.env.PORT || 4006;

const ALLOWED_ORIGINS = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '10kb' }));
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    },
    methods: ['POST', 'GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use('/api/notifications', rateLimiter, notificationRoutes);

app.use(
  (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    // NOTIF-04 (CWE-346): a disallowed Origin previously surfaced as a 500.
    // Answer with a clean 403 (still without reflecting the offending origin).
    if (err instanceof Error && err.message === 'Not allowed by CORS') {
      res.status(403).json({ error: 'Origin not allowed' });
      return;
    }
    if (err && (err as { type?: string }).type) {
      res.status(400).json({ error: 'Malformed or oversized request body' });
      return;
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
);

// Startup is kept separate from module load so integration tests can import
// the Express app directly (via `export default app`) and attach their own
// database (mongodb-memory-server) without a real Mongo connection.
export async function startServer(): Promise<void> {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('FATAL: MONGO_URI is not configured. Exiting.');
    process.exit(1);
  }

  // NOTIF-01: fail fast instead of running with an empty JWT secret (which would
  // make every token invalid and silently break the endpoint).
  if (!process.env.JWT_SECRET) {
    console.error('FATAL: JWT_SECRET is not configured. Exiting.');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

export default app;