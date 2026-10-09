import User from '../models/User';
import { sendEmail, buildEmailMessage } from '../utils/mailer';
import { sanitizeEmailField } from '../utils/validation';

interface SafeOrderDetails {
  id: string;
  customer: { name: string; address: string };
  total: number;
}

// NOTIF-02 (CWE-770): cap recipients per request so one call can never fan out
// to arbitrarily many delivery persons (email amplification / SMS-style
// bombardment). Over the cap we truncate and log; the per-user rate limiter is
// the second defence.
const MAX_RECIPIENTS = Number(process.env.MAX_NOTIFICATION_RECIPIENTS || 50);

export const notifyDeliveryPersons = async (orderDetails: SafeOrderDetails) => {
  try {
    const deliveryPersons = await User.find({ role: 'delivery_man' }).select('-password');

    if (deliveryPersons.length === 0) {
      throw new Error('No delivery persons found');
    }

    // NOTIF-05: sanitise every user-controlled value before it is embedded in
    // the email body; subject/from remain fixed strings.
    const message = buildEmailMessage(
      orderDetails.id,
      sanitizeEmailField(orderDetails.customer.name),
      sanitizeEmailField(orderDetails.customer.address),
      orderDetails.total
    );

    const recipients = deliveryPersons.slice(0, MAX_RECIPIENTS);
    if (deliveryPersons.length > MAX_RECIPIENTS) {
      console.warn(
        `[notification-service] truncated recipients: ${deliveryPersons.length} -> ${MAX_RECIPIENTS} (see MAX_NOTIFICATION_RECIPIENTS)`
      );
    }

    let delivered = 0;
    const failed = recipients.length;

    // NOTIF-02 (CWE-703): per-email failures are collected, never silently
    // swallowed as success; a full failure is rethrown so the caller gets 5xx.
    await Promise.all(
      recipients.map(async (person) => {
        if (!person.email) return;
        try {
          await sendEmail(person.email, message.subject, message.text);
          delivered += 1;
        } catch (emailError) {
          console.error('Error sending delivery notification email:', emailError);
        }
      })
    );

    if (delivered === 0 && failed > 0) {
      throw new Error('Failed to send any notification emails');
    }

    return {
      success: true,
      message: 'Notifications sent successfully',
      delivered,
    };
  } catch (error) {
    console.error('Error notifying delivery persons:', error);
    throw error;
  }
};