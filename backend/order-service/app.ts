import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/database'; // No need for .ts in this case
import orderRoutes from './routes/orderRoutes';

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();
app.use(cors());
app.use(express.json());

// Order routes
app.use('/api', orderRoutes);

const PORT = process.env.PORT || 3020;

const server = app.listen(PORT, () => {
  console.log(`Order service running on port ${PORT}`);
});

// Gracefully handle shutdown to release the port
process.on('SIGINT', () => {
  console.log("Gracefully shutting down...");
  server.close(() => {
    console.log("Closed server, freeing up port.");
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log("SIGTERM received, shutting down gracefully...");
  server.close(() => {
    console.log("Closed server after SIGTERM.");
    process.exit(0);
  });
});
