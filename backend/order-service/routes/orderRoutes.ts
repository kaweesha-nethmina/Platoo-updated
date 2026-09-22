import express, { Request, Response } from 'express';
import {
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrder,
  deleteOrder,
  getOrdersByUserId,
  updateOrderStatus,
  confirmPaymentHandler,
} from '../controllers/orderController';
import { AuthRequest, protect, USER_ROLE } from '../middleware/authenticate';

const router = express.Router();

/**
 * V-04 / V-12: every order-service route now requires authentication.
 * - `protect()` validates the user-service JWT and attaches `req.user`.
 * - Resource-level routes also enforce object-level authorization (ownership)
 *   inside the controllers via `isOwnerOrPrivileged`.
 * - `GET /orders` is restricted to privileged roles (admin, restaurant owner,
 *   delivery person); customers use `GET /orders/history/:userId`.
 * - Trusted service-to-service callers (payment-service) authenticate with the
 *   shared `x-internal-key` header and are treated as admin.
 */

// Create a new order
router.post('/orders', protect(), async (req: Request, res: Response) => {
  try {
    await createOrder(req as AuthRequest, res);
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ message: 'Error creating order', error: error.message });
    } else {
      res.status(500).json({ message: 'Unknown error occurred' });
    }
  }
});

// Get all orders (privileged roles only — V-12)
router.get(
  '/orders',
  protect([USER_ROLE.ADMIN, USER_ROLE.RESTAURANT_OWNER, USER_ROLE.DELIVERY_MAN]),
  async (req: Request, res: Response) => {
    try {
      await getAllOrders(req, res);
    } catch (error: unknown) {
      if (error instanceof Error) {
        res.status(500).json({ message: 'Error fetching orders', error: error.message });
      } else {
        res.status(500).json({ message: 'Unknown error occurred' });
      }
    }
  }
);

// Get order by ID (ownership enforced in controller)
router.get('/orders/:orderId', protect(), async (req: Request, res: Response) => {
  try {
    await getOrderById(req as AuthRequest, res);
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ message: 'Error fetching order', error: error.message });
    } else {
      res.status(500).json({ message: 'Unknown error occurred' });
    }
  }
});

// Update an order (ownership enforced in controller)
router.put('/orders/:orderId', protect(), async (req: Request, res: Response) => {
  try {
    await updateOrder(req as AuthRequest, res);
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ message: 'Error updating order', error: error.message });
    } else {
      res.status(500).json({ message: 'Unknown error occurred' });
    }
  }
});

// Delete an order (ownership enforced in controller)
router.delete('/orders/:orderId', protect(), async (req: Request, res: Response) => {
  try {
    await deleteOrder(req as AuthRequest, res);
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ message: 'Error deleting order', error: error.message });
    } else {
      res.status(500).json({ message: 'Unknown error occurred' });
    }
  }
});

// Get orders by user_id  -> /orders/history/:userId (:userId must match JWT subject)
router.get('/orders/history/:userId', protect(), async (req: Request, res: Response) => {
  try {
    await getOrdersByUserId(req as AuthRequest, res);
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ message: 'Error fetching orders by user ID', error: error.message });
    } else {
      res.status(500).json({ message: 'Unknown error occurred' });
    }
  }
});

// Update only the status of an order (restaurant owners / delivery persons / admins)
router.patch(
  '/orders/:orderId/status',
  protect([USER_ROLE.ADMIN, USER_ROLE.RESTAURANT_OWNER, USER_ROLE.DELIVERY_MAN]),
  async (req: Request, res: Response) => {
    try {
      const { orderId } = req.params;
      const { status } = req.body;
      await updateOrderStatus(orderId, status, res);
    } catch (error: unknown) {
      if (error instanceof Error) {
        res.status(500).json({ message: 'Error updating order status', error: error.message });
      } else {
        res.status(500).json({ message: 'Unknown error occurred' });
      }
    }
  }
);

// Confirm a payment for an order (server-side Stripe verification via payment-service)
router.patch('/orders/:orderId/payment', protect(), async (req: Request, res: Response) => {
  try {
    await confirmPaymentHandler(req as AuthRequest, res);
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ message: 'Error confirming payment', error: error.message });
    } else {
      res.status(500).json({ message: 'Unknown error occurred' });
    }
  }
});

export default router;