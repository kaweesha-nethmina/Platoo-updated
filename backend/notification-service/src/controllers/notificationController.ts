import { Request, Response } from 'express';
import { notifyDeliveryPersons } from '../services/notificationService';
import { validateOrderDetails } from '../utils/validation';
import { AuthRequest } from '../middleware/auth';

export const sendDeliveryNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderDetails } = req.body;

    if (!orderDetails || !validateOrderDetails(orderDetails)) {
      res.status(400).json({ error: 'Invalid order details' });
      return;
    }

    const actor = (req as AuthRequest).user;
    console.log(
      `Delivery notification triggered by role=${actor?.role} id=${actor?.id} for order=${orderDetails.id}`
    );

    const result = await notifyDeliveryPersons(orderDetails);

    res.status(200).json(result);
  } catch (error) {
    console.error('Error sending delivery notification:', error);
    res.status(500).json({ error: 'Failed to send notifications' });
  }
};