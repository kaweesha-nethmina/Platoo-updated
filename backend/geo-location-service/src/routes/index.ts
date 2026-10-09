import express from 'express';
import { addLocation, updateLocationById, getAllLocations, getDirections } from '../controllers/locationController';
import { authMiddleware } from '../middleware/auth';
import { rateLimitDirections } from '../middleware/rateLimit';

const router = express.Router();

router.post('/add-location', authMiddleware, addLocation);
router.put('/update-location/:userId', authMiddleware, updateLocationById);
router.get('/all-locations', authMiddleware, getAllLocations);
router.get('/get-directions', authMiddleware, rateLimitDirections, getDirections);

export default router;