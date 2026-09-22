import mongoose from 'mongoose';
import axios from 'axios';
import Order, { IOrder, IOrderItem } from '../models/order';
import OrderCounter from '../models/OrderCounter';
import { sendEmail } from '../utils/mailer';

// Tax rate applied server-side so the charged total is always computed by the
// backend. Matches the 8% rate the checkout UI displays.
export const TAX_RATE = 0.08;

export const VALID_ORDER_STATUSES = ['pending', 'preparing', 'ready', 'delivered', 'cancelled'];

const round2 = (n: number): number => Math.round(n * 100) / 100;

export interface CreateOrderResult {
  order: IOrder;
  replayed: boolean;
}

export class OrderService {
  // Base URLs of the sibling services, overridable via env.
  private static getMenuServiceUrl(): string {
    return process.env.MENU_SERVICE_URL || 'http://localhost:3001';
  }

  private static getPaymentServiceUrl(): string {
    return process.env.PAYMENT_SERVICE_URL || 'http://localhost:8081';
  }

  // Resolve the items against the menu service so prices (and names) always
  // come from the server-side catalog, never from the client. Throws if any
  // item is missing or invalid so the whole order is rejected.
  static async resolveTrustedItems(items: IOrderItem[]): Promise<IOrderItem[]> {
    const quotes = items.map((item) => ({
      menu_item_id: String(item.menu_item_id),
      quantity: item.quantity,
    }));

    let response;
    try {
      response = await axios.post<{ valid: unknown[]; invalid: unknown[] }>(
        `${this.getMenuServiceUrl()}/api/menu-items/quote`,
        { items: quotes },
        { timeout: 5000 }
      );
    } catch (error) {
      console.error('Menu service price lookup failed:', error);
      throw new Error('Price lookup failed');
    }

    const body = response.data ?? {};
    const valid: unknown[] = Array.isArray(body.valid) ? body.valid : [];
    const invalid: unknown[] = Array.isArray(body.invalid) ? body.invalid : [];

    if (invalid.length > 0) {
      console.error('Invalid menu items in order:', invalid);
      throw new Error('Invalid menu items in order');
    }

    if (valid.length !== items.length) {
      console.error('Menu item count mismatch. Sent:', items.length, 'Valid:', valid.length);
      throw new Error('Invalid menu items in order');
    }

    return valid.map((entry: any) => ({
      menu_item_id: entry.menu_item_id,
      name: entry.name,
      quantity: entry.quantity,
      price: entry.price,
    }));
  }

  // Delivery fee is an authoritative property of the restaurant record in the
  // menu service. The client-supplied value is never used.
  private static parseDeliveryFee(raw: unknown): number {
    if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) return raw;
    if (typeof raw === 'string') {
      const m = raw.replace(/,/g, '').match(/\d+(\.\d+)?/);
      if (m) {
        const n = Number(m[0]);
        if (Number.isFinite(n) && n >= 0) return n;
      }
    }
    return 0;
  }

  private static async resolveRestaurantDeliveryFee(restaurant_id: string): Promise<number> {
    let resp;
    try {
      resp = await axios.get(`${this.getMenuServiceUrl()}/api/restaurants/${restaurant_id}`, {
        timeout: 5000,
      });
    } catch (error) {
      console.error('Restaurant lookup failed for delivery fee:', error);
      throw new Error('Restaurant not found');
    }
    const restaurant = resp.data ?? {};
    const fee: unknown = (restaurant as Record<string, unknown>).deliveryFee;
    return this.parseDeliveryFee(fee);
  }

  // Money math for an order is centralized so create/update cannot drift.
  private static computeTotals(
    trustedItems: IOrderItem[],
    delivery_fee: number
  ): { subtotal: number; tax: number; delivery_fee: number; total_amount: number } {
    const subtotal = round2(trustedItems.reduce((acc, item) => acc + item.price * item.quantity, 0));
    const tax = round2(subtotal * TAX_RATE);
    const fee = round2(delivery_fee);
    return { subtotal, tax, delivery_fee: fee, total_amount: round2(subtotal + fee + tax) };
  }

  // Create a new order. All monetary values are computed server-side: item
  // prices come from the catalog, the delivery fee comes from the restaurant
  // record, and tax is a server-side percentage. A client-supplied effective
  // price/delivery fee/total can never reach the document.
  static async createOrder(params: {
    user_id: string;
    items: IOrderItem[];
    restaurant_id: string;
    delivery_address: string;
    phone: string;
    email: string;
    location: { lat: number; lng: number };
    idempotency_key?: string;
  }): Promise<CreateOrderResult> {
    const { user_id, items, restaurant_id, delivery_address, phone, email, location, idempotency_key } = params;

    // Replay protection: a repeated submission carrying the same key already
    // has an order — return it instead of minting a duplicate.
    if (idempotency_key) {
      const existing = await Order.findOne({ user_id, idempotency_key });
      if (existing) {
        return { order: existing, replayed: true };
      }
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      // V-07: prices come from the server-side catalog, never from the client.
      const trustedItems = await this.resolveTrustedItems(items);

      // V-07 residual: the delivery fee is resolved from the restaurant record
      // server-side, never trusted from the request body.
      const deliveryFee = await this.resolveRestaurantDeliveryFee(restaurant_id);
      const totals = this.computeTotals(trustedItems, deliveryFee);

      if (totals.subtotal <= 0) {
        throw new Error('No valid menu items found for the order.');
      }

      let orderCounter = await OrderCounter.findOne({ name: 'orderId' }).session(session);
      if (!orderCounter) {
        const newCounter = new OrderCounter({ name: 'orderId', count: 1 });
        orderCounter = await newCounter.save({ session });
      } else {
        orderCounter.count += 1;
        orderCounter = await orderCounter.save({ session });
      }

      const orderId = `ORD${orderCounter.count.toString().padStart(3, '0')}`;
      const order = new Order({
        order_id: orderId,
        user_id,
        total_amount: totals.total_amount,
        items: trustedItems,
        status: 'pending',
        restaurant_id,
        delivery_fee: totals.delivery_fee,
        tax: totals.tax,
        delivery_address,
        phone,
        email,
        location,
        idempotency_key: idempotency_key || undefined,
      });

      await order.save({ session });
      await session.commitTransaction();
      session.endSession();

      // NOTE: the confirmation email is sent when the payment is verified
      // (see confirmPayment), not when the order record is created, so we
      // never email customers whose checkout is abandoned before payment.

      return { order, replayed: false };
    } catch (error: unknown) {
      await session.abortTransaction();
      session.endSession();
      if (error instanceof Error) {
        // A racing duplicate with the same idempotency key: the unique index
        // rejected this write, so return the winner's order.
        const code = (error as unknown as { code?: number }).code;
        if (code === 11000 && idempotency_key) {
          const existing = await Order.findOne({ user_id, idempotency_key });
          if (existing) {
            return { order: existing, replayed: true };
          }
        }
        throw error;
      }
      throw new Error('Unknown error occurred');
    }
  }

  // Get all orders (privileged roles only — route-level gate)
  static async getAllOrders() {
    return await Order.find();
  }

  // Get an order by its ID (either Mongo ObjectId or custom order_id)
  static async getOrderById(orderId: string) {
    try {
      const order = mongoose.Types.ObjectId.isValid(orderId)
        ? await Order.findById(orderId)
        : await Order.findOne({ order_id: orderId });

      if (!order) {
        throw new Error('Order not found');
      }
      return order;
    } catch (error) {
      if (error instanceof Error && error.message === 'Order not found') {
        throw error;
      }
      throw new Error(`Error retrieving order with ID: ${orderId}`);
    }
  }

  // Update an existing order. Money is always recomputed server-side and the
  // owner (user_id) is preserved — an admin editing an order can never adopt
  // ownership. `allowStatusChange` is only true for staff/privileged callers.
  static async updateOrder(
    orderId: string,
    body: {
      items: IOrderItem[];
      restaurant_id: string;
      delivery_address?: string;
      phone?: string;
      email?: string;
      location?: { lat: number; lng: number };
      status?: string;
    },
    allowStatusChange: boolean
  ) {
    const order = await this.getOrderById(orderId);

    const trustedItems = await this.resolveTrustedItems(body.items);

    const deliveryFee = await this.resolveRestaurantDeliveryFee(
      body.restaurant_id || String(order.restaurant_id)
    );
    const totals = this.computeTotals(trustedItems, deliveryFee);

    const restaurantIdValue: string = body.restaurant_id || String(order.restaurant_id);
    order.items = trustedItems;
    order.restaurant_id = new mongoose.Types.ObjectId(restaurantIdValue) as unknown as string;
    order.delivery_fee = totals.delivery_fee;
    order.tax = totals.tax;
    order.total_amount = totals.total_amount;

    if (body.delivery_address !== undefined) order.delivery_address = body.delivery_address;
    if (body.phone !== undefined) order.phone = body.phone;
    if (body.email !== undefined) order.email = body.email;
    if (body.location !== undefined) order.location = body.location;

    if (body.status !== undefined) {
      if (!allowStatusChange) {
        throw new Error('Not permitted to change order status');
      }
      if (!VALID_ORDER_STATUSES.includes(body.status)) {
        throw new Error('Invalid status provided');
      }
      order.status = body.status;
    }

    await order.save();
    return order;
  }

  // Delete an order
  static async deleteOrder(orderId: string) {
    try {
      const order = await Order.findById(orderId);

      if (!order) {
        throw new Error('Order not found');
      }

      if (order.status !== 'pending' && order.status !== 'delivered') {
        throw new Error('Order cannot be deleted unless its status is "pending" or "delivered"');
      }

      await order.deleteOne();
      return order;
    } catch (error) {
      if (error instanceof Error && error.message === 'Order not found') {
        throw error;
      }
      throw new Error(`Error deleting order with ID: ${orderId}`);
    }
  }

  // Get orders by user_id
  static async getOrdersByUserId(userId: string) {
    try {
      const orders = await Order.find({ user_id: userId });
      if (!orders || orders.length === 0) {
        throw new Error('No orders found for this user');
      }
      return orders;
    } catch (error) {
      if (error instanceof Error && error.message === 'No orders found for this user') {
        throw error;
      }
      throw new Error('Error fetching orders by user ID');
    }
  }

  // Resolve the owner of a restaurant (used to scope restaurant-owner actions
  // to restaurants they actually own).
  static async getRestaurantOwnerId(restaurant_id: string): Promise<string | null> {
    try {
      const resp = await axios.get(
        `${this.getMenuServiceUrl()}/api/restaurants/${restaurant_id}`,
        { timeout: 5000 }
      );
      const restaurant = resp.data ?? {};
      const ownerId: unknown = (restaurant as Record<string, unknown>).owner_id;
      return typeof ownerId === 'string' ? ownerId : null;
    } catch (error) {
      console.error('Restaurant owner lookup failed:', error);
      return null;
    }
  }

  // Get orders by restaurant_id
  static async getOrdersByRestaurantId(restaurantId: string) {
    try {
      const orders = await Order.find({ restaurant_id: restaurantId });
      if (!orders || orders.length === 0) {
        throw new Error('No orders found for this restaurant');
      }
      return orders;
    } catch (error) {
      if (error instanceof Error && error.message === 'No orders found for this restaurant') {
        throw error;
      }
      throw new Error('Error fetching orders by restaurant ID');
    }
  }

  // Update only the status of an order (by Mongo _id or custom order_id)
  static async updateOrderStatus(orderId: string, status: string) {
    if (!status || !VALID_ORDER_STATUSES.includes(status)) {
      throw new Error('Invalid status provided');
    }

    try {
      const order = mongoose.Types.ObjectId.isValid(orderId)
        ? await Order.findById(orderId)
        : await Order.findOne({ order_id: orderId });

      if (!order) {
        throw new Error('Order not found');
      }

      order.status = status;
      await order.save({ validateBeforeSave: false });

      return order;
    } catch (error) {
      if (error instanceof Error && error.message === 'Order not found') {
        throw error;
      }
      throw new Error(`Error updating status of order with ID: ${orderId}`);
    }
  }

  // Confirm an order's payment. The Stripe session is verified server-side
  // through the payment service; only a genuinely paid session whose metadata
  // order_id matches this order is accepted. Idempotent.
  static async confirmPayment(orderId: string, sessionId: string) {
    if (!sessionId) {
      throw new Error('Payment not verified');
    }

    let order;
    try {
      order = mongoose.Types.ObjectId.isValid(orderId)
        ? await Order.findById(orderId)
        : await Order.findOne({ order_id: orderId });
    } catch {
      throw new Error('Order not found');
    }

    if (!order) {
      throw new Error('Order not found');
    }

    let verifyResponse;
    try {
      verifyResponse = await axios.get<{ status?: string; orderId?: string }>(
        `${this.getPaymentServiceUrl()}/api/verify-payment/${encodeURIComponent(sessionId)}`,
        { timeout: 5000 }
      );
    } catch (error) {
      console.error('Payment verification failed:', error);
      throw new Error('Payment not verified');
    }

    const body = verifyResponse.data ?? {};
    if (body.status !== 'success' || String(body.orderId) !== String(order._id)) {
      console.error('Payment verification mismatch', {
        sessionStatus: body.status,
        sessionOrderId: body.orderId,
      });
      throw new Error('Payment not verified');
    }

    if (order.payment_status === 'paid') {
      return order;
    }

    order.payment_status = 'paid';
    order.paid_at = new Date();
    await order.save();

    try {
      const subject = 'Order Confirmation';
      const text = `Your order with ID: ${order.order_id} has been placed and paid successfully. We will notify you once it's ready.`;
      const html = `<h3>Order Confirmation</h3><p>Your order with ID: <strong>${order.order_id}</strong> has been placed and paid successfully. We will notify you once it's ready.</p>`;
      await sendEmail(order.email, subject, text, html);
    } catch (emailError) {
      console.error('Confirmation email failed:', emailError);
    }

    return order;
  }
}