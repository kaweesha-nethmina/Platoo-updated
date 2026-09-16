import express from 'express';
//import { submitRating, fetchAverageRating } from '../controllers/ratingController';
import { submitRating, fetchAverageRating } from '../controllers/ratingController.js';

const router = express.Router();

// POST /api/ratings - Submit a rating
router.post('/', submitRating);

// GET /api/ratings/:restaurantId - Fetch average rating for a restaurant
router.get('/:restaurantId', fetchAverageRating);

export default router;