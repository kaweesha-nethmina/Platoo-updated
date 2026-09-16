import express from 'express';
import { addLocation, updateLocationById, getAllLocations, getDirections } from '../controllers/locationController';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

router.post('/add-location', authMiddleware, addLocation);
router.put('/update-location/:userId', authMiddleware,updateLocationById);
router.get('/all-locations', authMiddleware, getAllLocations);
router.get('/get-directions', getDirections);

export default router;
