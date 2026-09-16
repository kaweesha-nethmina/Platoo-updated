import express from 'express';
import { sendDeliveryNotification } from '../controllers/notificationController'; // Correct import

const router = express.Router();

// POST /api/notifications/send-delivery-notification
router.post('/send-delivery-notification', sendDeliveryNotification);

export default router;
