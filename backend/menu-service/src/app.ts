import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import restaurantRoutes from './routes/restaurant.routes';
import menuItemRoutes from './routes/menuItem.routes';
import categoryRoutes from './routes/category.routes';
import uploadRoutes from './routes/upload.routes';

const app = express();

// Security hardening.
app.use(helmet());

// CORS restricted to configured origins (no-origin requests allowed).
const corsOrigins = (
  process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://127.0.0.1:3000'
)
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

// Cap JSON payloads (multipart uploads via multer are unaffected).
app.use(express.json({ limit: '32kb' }));

// Helmet's default Cross-Origin-Resource-Policy: same-origin would block the browser
// from loading these public images cross-origin (page on :3000, assets on :3001).
// Relax CORP only for the uploads directory; APIs stay same-origin.
app.use((req, res, next) => {
  if (req.path.startsWith('/uploads/')) {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  }
  next();
});
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/category', categoryRoutes);
app.use('/api/menu-items', menuItemRoutes);
app.use('/api/upload', uploadRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Not found' });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[menu-service] error:', err instanceof Error ? err.stack : err);
  res.status(500).json({ message: 'Internal server error' });
});

export default app;