import User from '../models/User';  // Assuming you have a User model
import { sendEmail } from '../utils/mailer';  // Import the sendEmail function from the mailer utility

export const notifyDeliveryPersons = async (orderDetails: any) => {
  try {
    // Fetch all users with the role 'delivery_man'
    const deliveryPersons = await User.find({ role: 'delivery_man' });

    if (deliveryPersons.length === 0) {
      throw new Error('No delivery persons found');
    }

    console.log('Found delivery persons:', deliveryPersons);  // Log fetched delivery persons

    // Send email to each delivery person
    const emailPromises = deliveryPersons.map(async (person) => {
      const emailContent = `
        New Order Details:
        Order ID: ${orderDetails.id}
        Customer: ${orderDetails.customer.name}
        Total: ${orderDetails.total}
        Address: ${orderDetails.customer.address}
      `;

      try {
        console.log(`Sending email to: ${person.email}`);  // Log recipient email
        await sendEmail(person.email, 'New Delivery Order', emailContent);
        console.log(`Email sent to ${person.email}`);  // Log success
      } catch (emailError) {
        console.error(`Error sending email to ${person.email}:`, emailError);  // Log specific error for each person
      }
    });

    // Wait for all email promises to finish
    await Promise.all(emailPromises);

    return { success: true, message: 'Notifications sent successfully' };
  } catch (error) {
    console.error('Error notifying delivery persons:', error);  // Log overall errors
    throw error;  // Rethrow error
  }
};
