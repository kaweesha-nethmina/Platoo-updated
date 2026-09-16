import express from 'express';
import cors from 'cors';
import searchRoutes from './routes/search.routes';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', searchRoutes);

export default app;