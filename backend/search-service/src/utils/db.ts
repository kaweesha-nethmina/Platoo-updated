import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
  try {
    // Connect to MongoDB without deprecated options
    const conn = await mongoose.connect(process.env.MONGO_URI || '', {});
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    // Explicitly handle the error type
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error('An unknown error occurred while connecting to MongoDB');
    }
    process.exit(1); // Exit the process with a failure code
  }
};

export default connectDB;