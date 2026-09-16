import { Request, Response } from 'express';
//import { createRating, getAverageRating } from '../services/ratingService';
import { createRating, getAverageRating } from '../services/ratingService.js';

export const submitRating = async (req: Request, res: Response) => {
  try {
    const { customerId, restaurantId, orderId, rating, review } = req.body;
    await createRating(customerId, restaurantId, orderId, rating, review);
    res.status(201).json({ message: 'Rating submitted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit rating' });
  }
};

export const fetchAverageRating = async (req: Request, res: Response) => {
  try {
    const { restaurantId } = req.params; // Correctly access params from the request object
    const avgRating = await getAverageRating(restaurantId);
    res.status(200).json({ averageRating: avgRating });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch average rating' });
  }
};