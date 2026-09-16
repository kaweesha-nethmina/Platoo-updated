import express, { Request, Response } from 'express';
import { createOrder, getAllOrders, getOrderById, updateOrder, deleteOrder, getOrdersByUserId, updateOrderStatus } from '../controllers/orderController';

const router = express.Router();

// Create a new order
router.post('/orders', async (req: Request, res: Response) => {
  try {
    await createOrder(req, res);  // Call the async handler function
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ message: 'Error creating order', error: error.message });
    } else {
      res.status(500).json({ message: 'Unknown error occurred' });
    }
  }
});

// Get all orders
router.get('/orders', async (req: Request, res: Response) => {
  try {
    await getAllOrders(req, res);
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ message: 'Error fetching orders', error: error.message });
    } else {
      res.status(500).json({ message: 'Unknown error occurred' });
    }
  }
});

// Get order by ID
router.get('/orders/:orderId', async (req: Request, res: Response) => {
  try {
    await getOrderById(req, res);
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ message: 'Error fetching order', error: error.message });
    } else {
      res.status(500).json({ message: 'Unknown error occurred' });
    }
  }
});

// Update an order
router.put('/orders/:orderId', async (req: Request, res: Response) => {
  try {
    await updateOrder(req, res);
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ message: 'Error updating order', error: error.message });
    } else {
      res.status(500).json({ message: 'Unknown error occurred' });
    }
  }
});

// Delete an order
router.delete('/orders/:orderId', async (req: Request, res: Response) => {
  try {
    await deleteOrder(req, res);
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ message: 'Error deleting order', error: error.message });
    } else {
      res.status(500).json({ message: 'Unknown error occurred' });
    }
  }
});


// Get orders by user_id
router.get('/orders/history/:userId', async (req: Request, res: Response) => {
    try {
      await getOrdersByUserId(req, res);  // Call the async handler function
    } catch (error: unknown) {
      if (error instanceof Error) {
        res.status(500).json({ message: 'Error fetching orders by user ID', error: error.message });
      } else {
        res.status(500).json({ message: 'Unknown error occurred' });
      }
    }
  });
// Update only the status of an order
router.patch('/orders/:orderId/status', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    // Call the controller function to update the order status
    await updateOrderStatus(orderId, status, res);
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ message: 'Error updating order status', error: error.message });
    } else {
      res.status(500).json({ message: 'Unknown error occurred' });
    }
  }
});
;
  
  
export default router;
