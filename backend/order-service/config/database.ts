import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
  const mongoURI = process.env.MONGO_URI;
  
  // Check if the MONGO_URI is defined
  if (!mongoURI) {
    console.error('MongoDB URI is not defined in the environment variables.');
    process.exit(1); // Exit the process if the MongoDB URI is not found
  }

  try {
    await mongoose.connect(mongoURI);
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1); // Exit the process on failure
  }
};

export default connectDB;
