import { Response } from 'express';
import { OrderService } from '../services/orderService';
import { AuthRequest, isOwnerOrPrivileged, USER_ROLE } from '../middleware/authenticate';
import { IDEMPOTENCY_KEY } from '../validators/order.schemas';

// Generic server-side logging helper: internals go to the server log only,
// never back to the API client.
const logError = (context: string, error: unknown): void => {
  console.error(`[order-service] ${context}:`, error instanceof Error ? error.stack || error.message : error);
};

// Create order
export const createOrder = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    // V-04: the caller's identity comes from the verified JWT, never from the
    // request body. A client supplying a different user_id is ignored.
    const user_id = req.user?.id;
    if (!user_id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Optional idempotency key (header). When present, a repeated submission
    // returns the previously created order instead of minting a duplicate.
    const rawKey = req.headers['idempotency-key'];
    let idempotency_key: string | undefined;
    if (typeof rawKey === 'string' && rawKey.trim().length > 0) {
      if (!IDEMPOTENCY_KEY.test(rawKey.trim())) {
        return res.status(400).json({ message: 'Invalid Idempotency-Key header' });
      }
      idempotency_key = rawKey.trim();
    }

    const { items, restaurant_id, delivery_address, phone, email, location } = req.body;

    const result = await OrderService.createOrder({
      user_id,
      items,
      restaurant_id,
      delivery_address,
      phone,
      email,
      location,
      idempotency_key,
    });

    if (result.replayed) {
      return res.status(200).json({ order: result.order, idempotent: true });
    }
    return res.status(201).json({ order: result.order });
  } catch (error: unknown) {
    logError('Error creating order', error);
    if (error instanceof Error) {
      if (error.message === 'Price lookup failed') {
        return res.status(400).json({ message: 'Order could not be validated against the menu' });
      }
      if (error.message === 'Restaurant not found') {
        return res.status(400).json({ message: 'Restaurant not found' });
      }
      if (error.message === 'Invalid menu items in order') {
        return res.status(400).json({ message: 'Invalid menu items in order' });
      }
      if (error.message === 'No valid menu items found for the order.') {
        return res.status(400).json({ message: 'Invalid order: no valid menu items' });
      }
    }
    return res.status(500).json({ message: 'Error creating order' });
  }
};

// Get all orders (route gated to admin / restaurant owner / delivery person).
// V-14: the result set is scoped server-side to the caller's role so a
// privileged user can never pull the entire order store:
// - admin / trusted internal service: full visibility, optionally narrowed to
//   one restaurant via ?restaurant_id=;
// - restaurant owner: only orders for restaurants they own (ownership proven
//   against the menu service);
// - delivery person: only orders in the delivery pipeline (preparing/ready/
//   delivered) — not every customer's history.
export const getAllOrders = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const role = req.user?.role;

    const restaurantIdQuery =
      typeof req.query.restaurant_id === 'string' ? req.query.restaurant_id : undefined;

    if (req.internal || role === USER_ROLE.ADMIN) {
      const orders = await OrderService.getAllOrders(
        restaurantIdQuery ? { restaurant_id: restaurantIdQuery } : undefined
      );
      return res.status(200).json(orders);
    }

    if (role === USER_ROLE.RESTAURANT_OWNER) {
      const ownerId = String(req.user?.id);

      if (restaurantIdQuery) {
        const owningId = await OrderService.getRestaurantOwnerId(restaurantIdQuery);
        if (!owningId || owningId !== ownerId) {
          return res.status(403).json({ message: 'Forbidden: You do not manage this restaurant' });
        }
        const orders = await OrderService.getAllOrders({ restaurant_id: restaurantIdQuery });
        return res.status(200).json(orders);
      }

      const ownRestaurantIds = await OrderService.getRestaurantsByOwnerId(ownerId);
      if (ownRestaurantIds.length === 0) {
        return res.status(200).json([]);
      }
      const orders = await OrderService.getAllOrders({
        restaurant_id: { $in: ownRestaurantIds },
      });
      return res.status(200).json(orders);
    }

    if (role === USER_ROLE.DELIVERY_MAN) {
      const orders = await OrderService.getAllOrders({
        status: { $in: ['preparing', 'ready', 'delivered'] },
      });
      return res.status(200).json(orders);
    }

    // Unreachable given the route-level role gate, but never leak data by default.
    return res.status(403).json({ message: 'Forbidden' });
  } catch (error) {
    logError('Error retrieving orders', error);
    return res.status(500).json({ message: 'Error retrieving orders' });
  }
};

// Get order by ID
export const getOrderById = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const orderId = req.params.orderId;
    const order = await OrderService.getOrderById(orderId);

    // V-04/V-12: object-level authorization — only the owner, a privileged
    // role (admin), or a trusted internal service may read this order.
    if (!isOwnerOrPrivileged(req, order.user_id)) {
      return res.status(403).json({ message: 'Forbidden: You do not own this order' });
    }

    return res.status(200).json(order);
  } catch (error) {
    if (error instanceof Error && error.message === 'Order not found') {
      return res.status(404).json({ message: 'Order not found' });
    }
    logError('Error retrieving order', error);
    return res.status(500).json({ message: 'Error retrieving order' });
  }
};

// Update Order Handler
export const updateOrder = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const orderId = req.params.orderId;

    let order;
    try {
      order = await OrderService.getOrderById(orderId);
    } catch (error) {
      if (error instanceof Error && error.message === 'Order not found') {
        return res.status(404).json({ message: 'Order not found' });
      }
      return res.status(500).json({ message: 'Error retrieving order' });
    }

    // V-04: object-level authorization — only the owner, a privileged role
    // (admin), or a trusted internal service may update this order.
    if (!isOwnerOrPrivileged(req, order.user_id)) {
      return res.status(403).json({ message: 'Forbidden: You do not own this order' });
    }

    // Status changes are a privileged operation: a customer editing their own
    // order may change items/contact details but can never move the order
    // status (which is driven by the restaurant/delivery/admin staff).
    const isStaff =
      req.internal === true ||
      req.user?.role === USER_ROLE.ADMIN ||
      req.user?.role === USER_ROLE.RESTAURANT_OWNER ||
      req.user?.role === USER_ROLE.DELIVERY_MAN;
    const allowStatusChange = isStaff && req.body.status !== undefined;

    const updatedOrder = await OrderService.updateOrder(orderId, req.body, allowStatusChange);
    return res.status(200).json(updatedOrder);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Order not found') {
      return res.status(404).json({ message: 'Order not found' });
    }
    if (error instanceof Error && error.message === 'Not permitted to change order status') {
      return res.status(403).json({ message: 'Forbidden: Only staff may change order status' });
    }
    if (error instanceof Error && error.message === 'Invalid status provided') {
      return res.status(400).json({ message: 'Invalid status provided' });
    }
    if (error instanceof Error && error.message === 'Invalid menu items in order') {
      return res.status(400).json({ message: 'Invalid menu items in order' });
    }
    logError('Error updating order', error);
    return res.status(500).json({ message: 'Error updating order' });
  }
};

// Update the status of an order (PATCH /orders/:orderId/status)
export const updateOrderStatus = async (
  req: AuthRequest,
  res: Response
): Promise<Response> => {
  const { orderId } = req.params;
  const { status } = req.body;

  try {
    let order;
    try {
      order = await OrderService.getOrderById(orderId);
    } catch (error) {
      if (error instanceof Error && error.message === 'Order not found') {
        return res.status(404).json({ message: 'Order not found' });
      }
      throw error;
    }

    // Scope restaurant owners to restaurants they actually own. Admins,
    // delivery staff, and trusted internal services operate across restaurants.
    if (
      !req.internal &&
      req.user?.role === USER_ROLE.RESTAURANT_OWNER &&
      order.restaurant_id
    ) {
      const ownerId = await OrderService.getRestaurantOwnerId(String(order.restaurant_id));
      if (!ownerId || ownerId !== String(req.user.id)) {
        return res.status(403).json({ message: 'Forbidden: You do not manage this restaurant' });
      }
    }

    const updatedOrder = await OrderService.updateOrderStatus(orderId, status);
    return res.status(200).json({
      message: 'Order status updated successfully',
      order: updatedOrder,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Order not found') {
      return res.status(404).json({ message: 'Order not found' });
    }
    if (error instanceof Error && error.message === 'Invalid status provided') {
      return res.status(400).json({ message: 'Invalid status provided' });
    }
    logError(`Error updating order status for ${orderId}`, error);
    return res.status(500).json({ message: 'Error updating order status' });
  }
};

// Delete Order Handler
export const deleteOrder = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const orderId = req.params.orderId;

    let order;
    try {
      order = await OrderService.getOrderById(orderId);
    } catch (error) {
      if (error instanceof Error && error.message === 'Order not found') {
        return res.status(404).json({ message: 'Order not found' });
      }
      return res.status(500).json({ message: 'Error retrieving order' });
    }

    // V-04: object-level authorization — only the owner, a privileged role
    // (admin), or a trusted internal service may delete this order.
    if (!isOwnerOrPrivileged(req, order.user_id)) {
      return res.status(403).json({ message: 'Forbidden: You do not own this order' });
    }

    await OrderService.deleteOrder(orderId);
    return res.status(200).json({ message: 'Order deleted successfully' });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Order not found') {
      return res.status(404).json({ message: 'Order not found' });
    }
    logError('Error deleting order', error);
    return res.status(500).json({ message: 'Error deleting order' });
  }
};

// Get orders by user_id handler
export const getOrdersByUserId = async (req: AuthRequest, res: Response): Promise<Response> => {
  try {
    const userId = req.params.userId;

    // V-12: prevent IDOR — the :userId path param must match the authenticated
    // user unless the caller is a trusted admin/internal service.
    if (!isOwnerOrPrivileged(req, userId)) {
      return res.status(403).json({ message: 'Forbidden: You may only view your own orders' });
    }

    const orders = await OrderService.getOrdersByUserId(userId);
    if (orders.length === 0) {
      return res.status(404).json({ message: 'No orders found for this user' });
    }
    return res.status(200).json(orders);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'No orders found for this user') {
      return res.status(404).json({ message: 'No orders found for this user' });
    }
    logError('Error fetching orders', error);
    return res.status(500).json({ message: 'Error fetching orders' });
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
    } catch (error) {
      if (error instanceof Error && error.message === 'Order not found') {
        return res.status(404).json({ message: 'Order not found' });
      }
      return res.status(500).json({ message: 'Error retrieving order' });
    }

    // V-04: only the order owner, a trusted internal service, or an admin may
    // confirm payment for an order.
    if (!isOwnerOrPrivileged(req, order.user_id)) {
      return res.status(403).json({ message: 'Forbidden: You do not own this order' });
    }

    const confirmedOrder = await OrderService.confirmPayment(orderId, sessionId);
    return res.status(200).json({ message: 'Payment confirmed', order: confirmedOrder });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Order not found') {
      return res.status(404).json({ message: 'Order not found' });
    }
    // Any verification failure is intentionally surfaced as a generic error
    // so the success-page decision is never based on forged client state.
    logError('Payment verification failed', error);
    return res.status(403).json({ message: 'Payment could not be verified' });
  }
};