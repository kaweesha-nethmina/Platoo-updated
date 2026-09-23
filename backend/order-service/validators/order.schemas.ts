import Joi from 'joi';
import { RequestHandler } from 'express';

// A Mongo ObjectId is a 24-character hex string.
const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

// Per-order safety caps. Quantities and item counts above these are rejected.
export const MAX_ITEMS = 50;
export const MAX_QUANTITY_PER_ITEM = 99;

/**
 * Security: every field named below is strictly FORBIDDEN at the API boundary.
 * The client may never choose prices, totals, identity, status, or payment
 * state. These are always derived server-side from the verified JWT and the
 * server-side catalog. `price`/`name` inside an item are tolerated because
 * legacy clients echo the displayed price, but they are ignored by the service
 * (which re-fetches authoritative data from the menu service).
 */
const forbiddenServerFields = {
  user_id: Joi.forbidden(),
  order_id: Joi.forbidden(),
  total_amount: Joi.forbidden(),
  subtotal: Joi.forbidden(),
  tax: Joi.forbidden(),
  delivery_fee: Joi.forbidden(),
  status: Joi.forbidden(),
  payment_status: Joi.forbidden(),
  paid_at: Joi.forbidden(),
  createdAt: Joi.forbidden(),
  updatedAt: Joi.forbidden(),
};

const itemSchema = Joi.object({
  // Aliases seen across clients; both are stripped down to menu_item_id.
  menu_item_id: Joi.string().pattern(OBJECT_ID).required(),
  productId: Joi.string().pattern(OBJECT_ID).optional(),
  menuItemId: Joi.string().pattern(OBJECT_ID).optional(),
  quantity: Joi.number().integer().min(1).max(MAX_QUANTITY_PER_ITEM).required(),
  // Present in legacy checkout payloads but never trusted (server re-quotes).
  price: Joi.number().min(0).optional(),
  name: Joi.string().max(255).optional(),
  image: Joi.string().max(512).optional(),
  id: Joi.string().allow('').optional(),
})
  .unknown(false)
  .required();

const locationSchema = Joi.object({
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),
}).unknown(false).required();

// Payload allowed on order creation. Everything else is stripped before the
// request reaches the service/controller.
export const createOrderSchema = Joi.object({
  restaurant_id: Joi.string().pattern(OBJECT_ID).required(),
  items: Joi.array().items(itemSchema).min(1).max(MAX_ITEMS).required(),
  delivery_address: Joi.string().trim().min(5).max(500).required(),
  phone: Joi.string()
    .trim()
    .pattern(/^[+0-9][0-9\s\-()]{6,19}$/)
    .required(),
  email: Joi.string().trim().email().max(254).required(),
  location: locationSchema,
  ...forbiddenServerFields,
}).options({ stripUnknown: true, abortEarly: false });

// Payload allowed when updating an existing order via PUT.
export const updateOrderSchema = Joi.object({
  restaurant_id: Joi.string().pattern(OBJECT_ID).required(),
  items: Joi.array().items(itemSchema).min(1).max(MAX_ITEMS).required(),
  delivery_address: Joi.string().trim().min(5).max(500).optional(),
  phone: Joi.string()
    .trim()
    .pattern(/^[+0-9][0-9\s\-()]{6,19}$/)
    .optional(),
  email: Joi.string().trim().email().max(254).optional(),
  location: locationSchema.optional(),
  ...forbiddenServerFields,
}).options({ stripUnknown: true, abortEarly: false });

// The status/body payload for PATCH /orders/:orderId/status.
// `status` is allowed here (it is the purpose of this endpoint) while every
// other server-owned field stays forbidden.
export const orderStatusSchema = Joi.object({
  status: Joi.string()
    .valid('pending', 'preparing', 'ready', 'delivered', 'cancelled')
    .required(),
  user_id: Joi.forbidden(),
  order_id: Joi.forbidden(),
  total_amount: Joi.forbidden(),
  subtotal: Joi.forbidden(),
  tax: Joi.forbidden(),
  delivery_fee: Joi.forbidden(),
  payment_status: Joi.forbidden(),
  paid_at: Joi.forbidden(),
  createdAt: Joi.forbidden(),
  updatedAt: Joi.forbidden(),
}).options({ stripUnknown: true, abortEarly: false });

// The Idempotency-Key header, if supplied, must be a safe token (UUID / base62).
export const IDEMPOTENCY_KEY = /^[A-Za-z0-9\-_]{8,128}$/;

/**
 * Validation middleware. Validates `req.body` against the provided schema and
 * returns a generic 400 with a summarized message on failure — no raw Joi
 * internals, schema details, or stack traces are leaked.
 */
export const validateBody =
  (schema: Joi.ObjectSchema): RequestHandler =>
  (req, res, next): void => {
    const { error, value } = schema.validate(req.body);
    if (error) {
      const summary = error.details
        .map((d) => d.path.join('.') || d.type)
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .slice(0, 10);
      res.status(400).json({ message: 'Invalid request body', failed: summary, count: error.details.length });
      return;
    }
    req.body = value;
    next();
  };