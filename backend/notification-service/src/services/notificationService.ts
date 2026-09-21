import User from '../models/User';
import { sendEmail } from '../utils/mailer';

interface SafeOrderDetails {
  id: string;
  customer: { name: string; address: string };
  total: number;
}

export const notifyDeliveryPersons = async (orderDetails: SafeOrderDetails) => {
  try {
    const deliveryPersons = await User.find({ role: 'delivery_man' }).select('-password');

    if (deliveryPersons.length === 0) {
      throw new Error('No delivery persons found');
    }

    // Never log full user documents (contains PII such as phone numbers).
    // recipients are not logged; failures log only the address.
    const emailContent = [
      'New Order Details:',
      `Order ID: ${orderDetails.id}`,
      `Customer: ${orderDetails.customer.name}`,
      `Total: ${orderDetails.total}`,
      `Address: ${orderDetails.customer.address}`,
    ].join('\n');

    const emailPromises = deliveryPersons.map(async (person) => {
      if (!person.email) return;
      try {
        await sendEmail(person.email, 'New Delivery Order', emailContent);
      } catch (emailError) {
        console.error('Error sending delivery notification email:', emailError);
      }
    });

    await Promise.all(emailPromises);

    return { success: true, message: 'Notifications sent successfully' };
  } catch (error) {
    console.error('Error notifying delivery persons:', error);
    throw error;
  }
};