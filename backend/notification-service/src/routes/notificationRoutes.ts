import express from 'express';
import { sendDeliveryNotification } from '../controllers/notificationController';
import { protect } from '../middleware/auth';

const router = express.Router();

// POST /api/notifications/send-delivery-notification
// Requires a valid JWT with role admin or restaurant_owner.
router.post('/send-delivery-notification', protect, sendDeliveryNotification);

export default router;