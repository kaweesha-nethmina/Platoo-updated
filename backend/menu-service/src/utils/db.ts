import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// [FIX VULN-05] strip MongoDB operator keys ($ne/$gt/$where/...) from query
// filters, blocking NoSQL operator injection in userId/category_id lookups.
mongoose.set('sanitizeFilter', true);

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI!);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    // Cast the error to an Error type to access its properties
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error('An unknown error occurred');
    }
    process.exit(1); // Exit the process on failure
  }
};

export default connectDB;