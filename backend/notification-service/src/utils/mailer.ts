import nodemailer from 'nodemailer';
import { createTransport } from './transport';

/**
 * NOTIFICATION-SERVICE mailer.
 *
 * NOTIF-05 (CWE-80/CWE-93): the subject and from address are fixed strings and
 * all user-controlled content goes into the plain-text body already sanitised
 * by sanitizeEmailField(), so CRLF/HTML input can never become headers or
 * rendered markup.
 *
 * NOTIF-06 (CWE-547): the transport is created from environment variables via
 * the injectable factory (no hard-coded Gmail credentials in this file).
 */

const SENDER = process.env.EMAIL_USER || 'dummy.sender@platoo.local';

// Created lazily so dotenv.config() has already run when the first email is
// dispatched (ESM imports evaluate before the app.ts dotenv statement).
let transporter: ReturnType<typeof createTransport> | null = null;
const getTransporter = (): ReturnType<typeof createTransport> => {
  transporter ??= createTransport();
  return transporter;
};

export interface EmailMessage {
  from: string;
  subject: string;
  text: string;
}

export const buildEmailMessage = (
  orderId: string,
  customerName: string,
  address: string,
  total: number
): EmailMessage => {
  const from = SENDER;
  const subject = 'New Delivery Order'; // fixed subject: user input never reaches headers
  const text = [
    'New Order Details:',
    `Order ID: ${orderId}`,
    `Customer: ${customerName}`,
    `Total: ${total}`,
    `Address: ${address}`,
  ].join('\n');
  return { from, subject, text };
};

export const sendEmail = async (to: string, subject: string, text: string): Promise<unknown> => {
  const mailOptions = {
    from: SENDER,
    to,
    subject,
    text,
  };
  return getTransporter().sendMail(mailOptions);
};