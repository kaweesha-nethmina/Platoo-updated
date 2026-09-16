import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
//import ratingRoutes from './routes/ratingRoutes';
import ratingRoutes from './routes/ratingRoutes.js'; // Add .js extension

dotenv.config();

import path from 'path';

// Load .env file from the root directory
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

console.log('Environment Variables:');
console.log('REDIS_HOST:', process.env.REDIS_HOST);
console.log('REDIS_PORT:', process.env.REDIS_PORT);

if (!process.env.REDIS_HOST || !process.env.REDIS_PORT) {
  throw new Error('Missing REDIS_HOST or REDIS_PORT in environment variables');
}

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());

// Routes
app.use('/api/ratings', ratingRoutes);

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI!)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});