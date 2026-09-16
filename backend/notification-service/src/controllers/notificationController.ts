import { Request, Response } from 'express';
import { notifyDeliveryPersons } from '../services/notificationService';  // Import the notification service

export const sendDeliveryNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderDetails } = req.body;

    // Validate order details
    if (!orderDetails) {
      res.status(400).json({ error: 'Order details are required' });
      return;
    }

    // Call the service to notify the delivery persons
    const result = await notifyDeliveryPersons(orderDetails);

    // Respond with success message
    res.status(200).json(result);
  } catch (error) {
    console.error('Error sending delivery notification:', error);  // Log error
    res.status(500).json({ error: (error as Error).message });  // Respond with error message
  }
};
