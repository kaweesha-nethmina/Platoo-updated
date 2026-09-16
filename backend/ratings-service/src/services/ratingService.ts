//import RatingModel from '../models/Rating';
//import { getCache, setCache } from '../utils/cache';
import RatingModel from '../models/Rating.js';
import { getCache, setCache } from '../utils/cache.js';

export const createRating = async (
  customerId: string,
  restaurantId: string,
  orderId: string,
  rating: number,
  review?: string
) => {
  const newRating = new RatingModel({ customerId, restaurantId, orderId, rating, review });
  await newRating.save();

  // Update average rating in cache
  const key = `restaurant:${restaurantId}:avgRating`;
  const avgRating = await calculateAverageRating(restaurantId);
  setCache(key, avgRating.toString());
};

export const getAverageRating = async (restaurantId: string): Promise<number> => {
  const key = `restaurant:${restaurantId}:avgRating`;
  const cachedRating = await getCache(key);

  if (cachedRating) {
    return parseFloat(cachedRating);
  }

  const avgRating = await calculateAverageRating(restaurantId);
  setCache(key, avgRating.toString());
  return avgRating;
};

const calculateAverageRating = async (restaurantId: string): Promise<number> => {
  const ratings = await RatingModel.find({ restaurantId }).select('rating');
  const total = ratings.reduce((sum, r) => sum + r.rating, 0);
  return ratings.length ? total / ratings.length : 0;
};