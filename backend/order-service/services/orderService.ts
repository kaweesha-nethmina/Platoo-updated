import mongoose from 'mongoose';
import Order, { IOrderItem } from '../models/order';
import OrderCounter from '../models/OrderCounter';
import { v4 as uuidv4 } from 'uuid';
import { sendEmail } from '../utils/mailer'; 

export class OrderService {
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
      const totalAmount = items.reduce((acc: number, item) => acc + item.price * item.quantity, 0);
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
        items: items,
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
  
      // Send an email after the order is created
      const subject = 'Order Confirmation';
      const text = `Your order with ID: ${orderId} has been placed successfully. We will notify you once it's ready.`;
      const html = `<h3>Order Confirmation</h3><p>Your order with ID: <strong>${orderId}</strong> has been placed successfully. We will notify you once it's ready.</p>`;
  
      await sendEmail(email, subject, text, html); // Send email
  
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

      order.user_id = user_id;
      order.items = items;
      order.status = status;
      order.restaurant_id = restaurant_id;

      // Recalculate total_amount including delivery fee
      const totalAmount = items.reduce((acc: number, item) => acc + item.price * item.quantity, 0);
      order.total_amount = totalAmount + delivery_fee; // Add delivery fee to the total amount
      order.delivery_fee = delivery_fee; // Update delivery fee

      await order.save();
      return order;
    } catch (error) {
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
}
