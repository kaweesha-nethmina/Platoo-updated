import { Request, Response } from 'express';
import { notifyDeliveryPersons } from '../services/notificationService';
import { AuthRequest } from '../middleware/auth';

interface OrderDetails {
  id: string;
  customer: { name: string; address: string };
  total: number;
}

const isValidOrderDetails = (details: unknown): details is OrderDetails => {
  if (typeof details !== 'object' || details === null) return false;

  const obj = details as Record<string, unknown>;
  const id = obj['id'];
  const customer = obj['customer'];
  const total = obj['total'];

  if (typeof id !== 'string' || id.length === 0 || id.length > 64) return false;
  if (typeof total !== 'number' || !Number.isFinite(total) || total < 0 || total > 1_000_000_000) {
    return false;
  }
  if (typeof customer !== 'object' || customer === null) return false;
  const name = (customer as Record<string, unknown>)['name'];
  const address = (customer as Record<string, unknown>)['address'];
  if (typeof name !== 'string' || name.length === 0 || name.length > 128) return false;
  if (typeof address !== 'string' || address.length === 0 || address.length > 256) return false;

  return true;
};

export const sendDeliveryNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderDetails } = req.body;

    if (!orderDetails || !isValidOrderDetails(orderDetails)) {
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