import { Request, Response } from 'express';
import { OrderService } from '../services/orderService';
import { AuthRequest, isOwnerOrPrivileged, USER_ROLE } from '../middleware/authenticate';

// Create order
export const createOrder = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    // V-04: the caller's identity comes from the verified JWT, never from the
    // request body. A client supplying a different user_id is ignored.
    const user_id = req.user?.id;

    const {
      items,
      restaurant_id,
      delivery_fee,
      delivery_address,
      phone,
      email,
      location, // Extract location from the request body
    } = req.body;

    if (
      !user_id ||
      !Array.isArray(items) ||
      items.length === 0 ||
      !restaurant_id ||
      delivery_fee === undefined ||
      !delivery_address ||
      !phone ||
      !email ||
      !location || // Validate the presence of location
      typeof location.lat !== 'number' ||
      typeof location.lng !== 'number'
    ) {
      const missing = {
        user_id: user_id ? undefined : 'missing',
        items: Array.isArray(items) && items.length > 0 ? undefined : (Array.isArray(items) ? 'empty' : 'not-an-array'),
        restaurant_id: restaurant_id ? undefined : 'missing',
        delivery_fee: delivery_fee !== undefined ? undefined : 'missing',
        delivery_address: delivery_address ? undefined : 'missing',
        phone: phone ? undefined : 'missing',
        email: email ? undefined : 'missing',
        location: location
          ? typeof location.lat !== 'number' || typeof location.lng !== 'number'
            ? `invalid-type lat=${typeof location.lat} lng=${typeof location.lng}`
            : undefined
          : 'missing',
      };
      const failed = Object.entries(missing).filter(([, v]) => v).map(([k, v]) => `${k}:${v}`);
      return res.status(400).json({
        message:
          'Invalid request body. Ensure user_id, items, restaurant_id, delivery_fee, delivery_address, phone, email, and location (with lat and lng) are provided.',
        failed,
      });
    }

    const order = await OrderService.createOrder(
      user_id,
      items,
      restaurant_id,
      delivery_fee,
      delivery_address,
      phone,
      email,
      location // Pass the location to the service
    );

    return res.status(201).json({ order });
  } catch (error: unknown) {
    if (error instanceof Error) {
      return res.status(500).json({ message: 'Error creating order', error: error.message });
    } else {
      return res.status(500).json({ message: 'Unknown error' });
    }
  }
};

// Get all orders
export const getAllOrders = async (req: Request, res: Response): Promise<Response> => {
  try {
    const orders = await OrderService.getAllOrders();
    return res.status(200).json(orders);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(500).json({ message: 'Error retrieving orders', error: error.message });
    } else {
      return res.status(500).json({ message: 'Unknown error' });
    }
  }
};

// Get order by ID
export const getOrderById = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const orderId = req.params.orderId;
    const order = await OrderService.getOrderById(orderId);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // V-04/V-12: object-level authorization — only the owner, a privileged
    // role (admin), or a trusted internal service may read this order.
    if (!isOwnerOrPrivileged(req, order.user_id)) {
      return res.status(403).json({ message: 'Forbidden: You do not own this order' });
    }

    return res.status(200).json(order);
  } catch (error) {
    if (error instanceof Error) {
      return res.status(500).json({ message: 'Error retrieving order', error: error.message });
    } else {
      return res.status(500).json({ message: 'Unknown error' });
    }
  }
};

// Update Order Handler
export const updateOrder = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const orderId = req.params.orderId;

    let order;
    try {
      order = await OrderService.getOrderById(orderId);
    } catch {
      return res.status(404).json({ message: 'Order not found' });
    }

    // V-04: object-level authorization — only the owner, a privileged role (admin),
    // or a trusted internal service may update this order.
    if (!isOwnerOrPrivileged(req, order.user_id)) {
      return res.status(403).json({ message: 'Forbidden: You do not own this order' });
    }

    // V-04: the caller's identity comes from the verified JWT, never from the body.
    const user_id = req.user?.id;
    const { items, status, restaurant_id, delivery_fee } = req.body;

    if (!user_id || !Array.isArray(items) || items.length === 0 || !restaurant_id) {
      return res.status(400).json({ message: 'Invalid request body, items, and restaurant_id are required' });
    }

    const updatedOrder = await OrderService.updateOrder(
      orderId,
      user_id,
      items,
      status,
      restaurant_id,
      delivery_fee
    );
    return res.status(200).json(updatedOrder);
  } catch (error: unknown) {
    if (error instanceof Error) {
      return res.status(500).json({ message: 'Error updating order', error: error.message });
    } else {
      return res.status(500).json({ message: 'Unknown error' });
    }
  }
};

// Update only the status of an order
export const updateOrderStatus = async (orderId: string, status: string, res: Response) => {
  // Validate the provided status
  const validStatuses = ['pending', 'delivered', 'preparing', 'ready', 'cancelled'];
  
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid status provided' });
  }

  try {
    // Call the service method to update the order status
    const updatedOrder = await OrderService.updateOrderStatus(orderId, status);

    // Respond with the updated order
    return res.status(200).json({
      message: 'Order status updated successfully',
      order: updatedOrder,
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ message: 'Error updating order status', error: error.message });
    } else {
      res.status(500).json({ message: 'Unknown error occurred' });
    }
  }
};
// Delete Order Handler
export const deleteOrder = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const orderId = req.params.orderId;

    let order;
    try {
      order = await OrderService.getOrderById(orderId);
    } catch {
      return res.status(404).json({ message: 'Order not found' });
    }

    // V-04: object-level authorization — only the owner, a privileged role (admin),
    // or a trusted internal service may delete this order.
    if (!isOwnerOrPrivileged(req, order.user_id)) {
      return res.status(403).json({ message: 'Forbidden: You do not own this order' });
    }

    await OrderService.deleteOrder(orderId);
    return res.status(200).json({ message: 'Order deleted successfully' });
  } catch (error: unknown) {
    if (error instanceof Error) {
      return res.status(500).json({ message: 'Error deleting order', error: error.message });
    } else {
      return res.status(500).json({ message: 'Unknown error' });
    }
  }
};

// Get orders by user_id handler
export const getOrdersByUserId = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.params.userId;  // Retrieve user_id from URL params

    // V-12: prevent IDOR — the :userId path param must match the authenticated
    // user unless the caller is a trusted admin/internal service.
    if (!isOwnerOrPrivileged(req, userId)) {
      return res.status(403).json({ message: 'Forbidden: You may only view your own orders' });
    }

    const orders = await OrderService.getOrdersByUserId(userId);
    if (orders.length === 0) {
      return res.status(404).json({ message: 'No orders found for this user' });
    }
    return res.status(200).json(orders);  // Return orders for the user
  } catch (error: unknown) {
    if (error instanceof Error) {
      return res.status(500).json({ message: 'Error fetching orders', error: error.message });
    } else {
      return res.status(500).json({ message: 'Unknown error' });
    }
  }
};

// Confirm an order's payment after server-side Stripe verification
export const confirmPaymentHandler = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const { orderId } = req.params;
    const { sessionId } = req.body ?? {};

    if (!orderId || !sessionId) {
      return res.status(400).json({ message: 'Order ID and session ID are required' });
    }

    let order;
    try {
      order = await OrderService.getOrderById(orderId);
    } catch {
      return res.status(404).json({ message: 'Order not found' });
    }

    // V-04: only the order owner, a trusted internal service, or an admin may
    // confirm payment for an order.
    if (!isOwnerOrPrivileged(req, order.user_id)) {
      return res.status(403).json({ message: 'Forbidden: You do not own this order' });
    }

    const confirmedOrder = await OrderService.confirmPayment(orderId, sessionId);
    return res.status(200).json({ message: 'Payment confirmed', order: confirmedOrder });
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.message === 'Order not found') {
        return res.status(404).json({ message: 'Order not found' });
      }
      // Any verification failure is intentionally surfaced as a generic error
      // so the success-page decision is never based on forged client state.
      return res.status(403).json({ message: 'Payment could not be verified' });
    }
    return res.status(500).json({ message: 'Unknown error' });
  }
};
