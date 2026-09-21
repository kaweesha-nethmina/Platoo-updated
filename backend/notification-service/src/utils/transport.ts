import nodemailer from 'nodemailer';

/**
 * NOTIFICATION-SERVICE mail transport factory.
 *
 * NOTIF-06 (CWE-547 / CWE-798): the original mailer hard-coded Nodemailer's
 * 'gmail' service and relied on committed-style credentials. This factory only
 * reads credentials from environment or explicit options (never literals), and
 * `verbose` switches to Nodemailer's JSON transport so tests and sandboxes can
 * send without any real SMTP account.
 */

export interface SmtpOptions {
  host?: string;
  port?: number;
  secure?: boolean;
  auth?: { user: string; pass: string };
  verbose?: boolean;
}

export const createTransport = (opts: SmtpOptions = {}): nodemailer.Transporter => {
  if (opts.verbose) {
    return nodemailer.createTransport({ jsonTransport: true });
  }
  const host = opts.host || process.env.SMTP_HOST || 'smtp.ethereal.email';
  const port = Number(opts.port || process.env.SMTP_PORT || 587);
  const auth =
    opts.auth ||
    (process.env.EMAIL_USER && process.env.EMAIL_PASS
      ? { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
      : undefined);
  return nodemailer.createTransport({ host, port, secure: opts.secure ?? false, auth });
};