import mongoose from 'mongoose';
import axios from 'axios';
import Order, { IOrderItem } from '../models/order';
import OrderCounter from '../models/OrderCounter';
import { v4 as uuidv4 } from 'uuid';
import { sendEmail } from '../utils/mailer';

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
      throw new Error('Invalid menu items in order');
    }

    return valid.map((entry: any) => ({
      menu_item_id: entry.menu_item_id,
      name: entry.name,
      quantity: entry.quantity,
      price: entry.price,
    }));
  }

  // Create a new order
  static async createOrder(
    user_id: string,
    items: IOrderItem[],
    restaurant_id: string,
    delivery_fee: number,
    delivery_address: string,
    phone: string,
    email: string,
    location: { lat: number; lng: number } // Add location parameter
  ) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      // V-07: prices come from the server-side catalog, never from the client.
      const trustedItems = await this.resolveTrustedItems(items);

      const totalAmount = trustedItems.reduce((acc: number, item) => acc + item.price * item.quantity, 0);
      const totalAmountWithDeliveryFee = totalAmount + delivery_fee;

      if (totalAmount === 0) {
        throw new Error("No valid menu items found for the order.");
      }

      let orderCounter = await OrderCounter.findOne({ name: 'orderId' });
      if (!orderCounter) {
        const newCounter = new OrderCounter({ name: 'orderId', count: 1 });
        orderCounter = await newCounter.save();
      } else {
        orderCounter.count += 1;
        orderCounter = await orderCounter.save();
      }

      const orderId = `ORD${orderCounter.count.toString().padStart(3, '0')}`;
      const order = new Order({
        order_id: orderId,
        user_id,
        total_amount: totalAmountWithDeliveryFee,
        items: trustedItems,
        status: 'pending',
        restaurant_id: restaurant_id,
        delivery_fee: delivery_fee,
        delivery_address: delivery_address,
        phone: phone,
        email: email,
        location: location, // Include the location field
      });

      await order.save({ session });
      await session.commitTransaction();
      session.endSession();

      // NOTE: the confirmation email is sent when the payment is verified
      // (see confirmPayment), not when the order record is created, so we
      // never email customers whose checkout is abandoned before payment.

      return order;
    } catch (error: unknown) {
      await session.abortTransaction();
      session.endSession();
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Unknown error occurred");
    }
  }


  // Get all orders
  static async getAllOrders() {
    try {
      return await Order.find();
    } catch (error) {
      throw new Error('Error fetching all orders');
    }
  }

  // Get an order by its ID (either Mongo ObjectId or custom order_id)
  static async getOrderById(orderId: string) {
    try {
      let order;

      // Check if the orderId is a valid ObjectId
      if (mongoose.Types.ObjectId.isValid(orderId)) {
        // If it is a valid ObjectId, search by _id
        order = await Order.findById(orderId);
      } else {
        // If it is not a valid ObjectId, search by order_id (the custom string)
        order = await Order.findOne({ order_id: orderId });
      }

      if (!order) {
        throw new Error('Order not found');
      }

      return order;
    } catch (error) {
      throw new Error(`Error retrieving order with ID: ${orderId}`);
    }
  }

  // Update an order
  static async updateOrder(orderId: string, user_id: string, items: IOrderItem[], status: string, restaurant_id: string, delivery_fee: number) {
    try {
      const order = await Order.findById(orderId);

      if (!order) {
        throw new Error('Order not found');
      }

      // V-07: prices come from the server-side catalog, never from the client.
      const trustedItems = await this.resolveTrustedItems(items);

      order.user_id = user_id;
      order.items = trustedItems;
      order.status = status;
      order.restaurant_id = restaurant_id;

      // Recalculate total_amount including delivery fee
      const totalAmount = trustedItems.reduce((acc: number, item) => acc + item.price * item.quantity, 0);
      order.total_amount = totalAmount + delivery_fee; // Add delivery fee to the total amount
      order.delivery_fee = delivery_fee; // Update delivery fee

      await order.save();
      return order;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Error updating order with ID: ${orderId}`);
      }
      throw new Error(`Error updating order with ID: ${orderId}`);
    }
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

      await order.deleteOne();  // Use deleteOne instead of remove
      return order;
    } catch (error) {
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
      throw new Error('Error fetching orders by user ID');
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
      throw new Error('Error fetching orders by restaurant ID');
    }
  }

  // Update only the status of an order by order_id (custom field)
  static async updateOrderStatus(orderId: string, status: string) {
    const validStatuses = ['pending', 'delivered', 'preparing', 'ready', 'cancelled'];

    if (!status || !validStatuses.includes(status)) {
      throw new Error('Invalid status provided');
    }

    try {
      const order = await Order.findOne({ order_id: orderId });

      if (!order) {
        throw new Error('Order not found');
      }

      order.status = status;

      // Save the updated order (This will only update the status)
      await order.save({ validateBeforeSave: false });  // Skip validation to avoid errors for required fields

      return order;
    } catch (error) {
      throw new Error(`Error updating status of order with ID: ${orderId}`);
    }
  }

  // Confirm an order's payment. The Stripe session is verified server-side
  // through the payment service; only a genuinely paid session whose metadata
  // order_id matches this order is accepted. Idempotent: a second call with an
  // already-paid order returns without re-sending the email.
  static async confirmPayment(orderId: string, sessionId: string) {
    if (!sessionId) {
      throw new Error('Payment not verified');
    }

    // Load the order first (by Mongo ObjectId or custom order_id)
    let order;
    try {
      order = mongoose.Types.ObjectId.isValid(orderId)
        ? await Order.findById(orderId)
        : await Order.findOne({ order_id: orderId });
    } catch (error) {
      throw new Error('Order not found');
    }

    if (!order) {
      throw new Error('Order not found');
    }

    // Server-side verification against the payment service, which itself
    // verifies the session with Stripe.
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

    // Send the confirmation email now that the payment is verified. Failures
    // are logged but never block the (successful, verified) confirmation.
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