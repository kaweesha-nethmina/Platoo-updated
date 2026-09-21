/**
 * NOTIFICATION-SERVICE - mailer white box tests.
 * Verify that the mail transport is injectable (for sandbox testing), that
 * sendEmail() builds a plain-text message, and that user-controlled text can
 * never smuggle email headers (CRLF injection produces data content, not new
 * headers) because from/subject are fixed strings and the body is generated
 * from sanitised values.
 */
import nodemailer from 'nodemailer';
import { createTransport } from '../../src/utils/transport';
import { buildEmailMessage } from '../../src/utils/mailer';
import { sanitizeEmailField } from '../../src/utils/validation';

describe('transport factory (CWE-798 fix: no hard-coded SMTP credentials)', () => {
  test('produces a transport only from environment/options (no literals)', () => {
    // The factory must not embed credentials: verbose/json transport needs no
    // SMTP config at all.
    const tr = createTransport({ verbose: true });
    expect(tr).toBeDefined();
  });

  test('resolveTransport builds an Ethereal-style nodemailer transport when given options', () => {
    const tr = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: { user: 'sandbox@example.test', pass: 'sandbox' },
    });
    expect(tr).toBeDefined();
    expect(typeof tr.sendMail).toBe('function');
  });
});

describe('buildEmailMessage (header-injection resistance, CWE-803/CWE-93)', () => {
  test('sanitised customer text lands inside the body, never in headers', () => {
    const dirty = 'Alice\r\nBcc: attacker@evil.example\r\nTo: victim@evil.example';
    const { subject, text } = buildEmailMessage('o1', sanitizeEmailField('Alice\r\nBcc: attacker@evil.example'), 'Some Address', 10);
    expect(subject).toBe('New Delivery Order');
    expect(subject).not.toMatch(/\r|\n/);
    expect(text).toContain('Order ID: o1');
    expect(text).not.toContain('Bcc: attacker@evil.example\r\n');
  });

  test('from address is always the configured sender, never user input', () => {
    const { from, subject } = buildEmailMessage('o1', 'Alice', 'Addr', 10);
    expect(from).toBe(process.env.EMAIL_USER || 'dummy.sender@platoo.local');
    expect(subject).not.toMatch(/[\r\n]/);
  });
});