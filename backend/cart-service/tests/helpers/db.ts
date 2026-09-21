/**
 * Shared test database helpers (SE4030).
 * Connects mongoose to the DEDICATED test database and cleans it between suites.
 */
import mongoose from 'mongoose';

export const TEST_MONGO_URI =
  process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/platoo_menu_test';

export const connectAndReset = async (): Promise<void> => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(TEST_MONGO_URI);
  }
  await mongoose.connection.dropDatabase();
};

export const clearCollections = async (): Promise<void> => {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
};

export const disconnectDb = async (): Promise<void> => {
  await mongoose.disconnect();
};