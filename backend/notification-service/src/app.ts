import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import notificationRoutes from './routes/notificationRoutes';

const cors = require('cors');
const app = express();
dotenv.config();
const PORT = process.env.PORT || 4006;

// Middleware
app.use(express.json());
app.use(cors());

// Routes
app.use('/api/notifications', notificationRoutes);

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || '')
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
      console.log('Server running on port ${PORT}');
    });
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
  });