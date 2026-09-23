import express, { Request, Response } from 'express';
import Joi from 'joi';
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
import { rejectNoSqlOperators } from '../middleware/noSqlAntiInjection';
import { createOrderSchema, orderStatusSchema, updateOrderSchema, validateBody } from '../validators/order.schemas';

const router = express.Router();

// (V-03 hygiene) Screen every request's params, query and body for MongoDB
// operator injection (`$`-keys, dot-notation keys, `$`-prefixed values) before
// any handler or Joi validation gets a chance to pass them to a query.
router.use(rejectNoSqlOperators);

const confirmPaymentSchema = Joi.object({
  sessionId: Joi.string().max(256).required(),
}).options({ stripUnknown: true, abortEarly: false });

/**
 * V-04 / V-12: every order-service route now requires authentication.
 * - `protect()` validates the user-service JWT and attaches `req.user`.
 * - Resource-level routes also enforce object-level authorization (ownership)
 *   inside the controllers via `isOwnerOrPrivileged`.
 * - `GET /orders` is restricted to privileged roles (admin, restaurant owner,
 *   delivery person); customers use `GET /orders/history/:userId`.
 * - Trusted service-to-service callers (payment-service) authenticate with the
 *   shared `x-internal-key` header and are treated as admin.
 * - Request bodies are validated against Joi schemas (see validators/); fields
 *   the client must not control (prices, totals, status, identity, payment
 *   state) are rejected.
 */

// Safe wrapper: if a controller ever throws, log server-side and return a
// generic message — never leak internal error details to the client.
const wrap =
  (handler: (req: AuthRequest, res: Response) => Promise<Response>) =>
  async (req: Request, res: Response): Promise<void> => {
    try {
      await handler(req as AuthRequest, res);
    } catch (error) {
      console.error('[order-service] route error:', error instanceof Error ? error.stack : error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };

// Create a new order (validated + rate limited; idempotency key optional)
router.post('/orders', protect(), validateBody(createOrderSchema), wrap(createOrder));

// Get all orders (privileged roles only — V-12)
router.get(
  '/orders',
  protect([USER_ROLE.ADMIN, USER_ROLE.RESTAURANT_OWNER, USER_ROLE.DELIVERY_MAN]),
  wrap(getAllOrders)
);

// Get orders by user_id -> /orders/history/:userId (:userId must match JWT subject).
// Registered BEFORE /orders/:orderId so the literal "history" segment wins.
router.get('/orders/history/:userId', protect(), wrap(getOrdersByUserId));

// Get order by ID (ownership enforced in controller)
router.get('/orders/:orderId', protect(), wrap(getOrderById));

// Update an order (ownership + server-side pricing enforced in controller)
router.put('/orders/:orderId', protect(), validateBody(updateOrderSchema), wrap(updateOrder));

// Delete an order (ownership enforced in controller)
router.delete('/orders/:orderId', protect(), wrap(deleteOrder));

// Update the status of an order (admin / restaurant owner / delivery person).
// Restaurant owners are additionally scoped to restaurants they own.
router.patch(
  '/orders/:orderId/status',
  protect([USER_ROLE.ADMIN, USER_ROLE.RESTAURANT_OWNER, USER_ROLE.DELIVERY_MAN]),
  validateBody(orderStatusSchema),
  wrap(updateOrderStatus)
);

// Confirm a payment for an order (server-side Stripe verification via payment-service)
router.patch(
  '/orders/:orderId/payment',
  protect(),
  validateBody(confirmPaymentSchema),
  wrap(confirmPaymentHandler)
);

export default router;