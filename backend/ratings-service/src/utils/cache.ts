import { createClient } from 'redis';
import dotenv from 'dotenv';

// Ensure env vars are loaded before validation (imports are hoisted above server.ts body)
dotenv.config();
dotenv.config({ path: `${process.cwd()}/.env` });

// Validate environment variables
if (!process.env.REDIS_HOST || !process.env.REDIS_PORT) {
  throw new Error('Missing REDIS_HOST or REDIS_PORT in environment variables');
}

const client = createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`
});

client.on('error', (err) => {
  console.error('Redis Client Error', err);
});

// Connect to Redis using an IIFE
(async () => {
  await client.connect();
})();

export const getCache = async (key: string): Promise<string | null> => {
  try {
    const data = await client.get(key);
    return data;
  } catch (err) {
    console.error('Error fetching from Redis:', err);
    throw err;
  }
};

export const setCache = async (key: string, value: string, ttl = 3600): Promise<void> => {
  try {
    await client.setEx(key, ttl, value);
  } catch (err) {
    console.error('Error setting cache in Redis:', err);
    throw err;
  }
};