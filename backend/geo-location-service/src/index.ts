import express, { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import crypto from 'crypto';
import dotenv from 'dotenv';
import locationRoutes from './routes';
import { setupSocketIO } from './services/realTimeTracking';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;
const MONGODB_URI = process.env.MONGODB_URI!;

app.use(helmet());
app.use(cors());
app.use(express.json());

mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

app.use('/api/location', locationRoutes);

app.get('/health', (_, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  const correlationId = crypto.randomUUID();
  console.error(`[${correlationId}] ${req.method} ${req.originalUrl} -`, err.stack || err.message);
  res.status(500).json({ error: 'Internal server error', correlationId });
});

const server = http.createServer(app);
setupSocketIO(server);

server.listen(PORT, () => {
  console.log(`Geo-location service running on port ${PORT}`);
});
