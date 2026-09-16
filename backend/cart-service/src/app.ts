import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import cartRoutes from './routes/cartRoutes';
import connectDB from './utils/db';

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Routes
app.use('/api/cart', cartRoutes);

// Connect to database
connectDB();

export default app;