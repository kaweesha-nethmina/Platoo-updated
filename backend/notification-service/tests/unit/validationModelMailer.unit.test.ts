/**
 * NOTIFICATION-SERVICE - UNIT tests: User model schema, mailer message building
 * and input validation/sanitisation helpers. Pure unit tests - no DB, no SMTP.
 */
import { UserRole } from '../../src/models/User';
import { validateOrderDetails, sanitizeEmailField } from '../../src/utils/validation';
import { buildEmailMessage } from '../../src/utils/mailer';

// Dynamically import mongoose only here - no Mongo connection is established,
// only the schema rules are inspected, so the User model is rendered covered.
const { default: User } = jest.requireActual('../../src/models/User') as typeof import('../../src/models/User');

describe('User model schema (role enum, required fields)', () => {
  const schema = User.schema as { paths: Record<string, { isRequired?: boolean; options?: { enum?: string[] } }> };

  test('exposes the four-role enum', () => {
    expect(Object.keys(UserRole)).toHaveLength(4);
    expect(Object.values(UserRole)).toEqual(['admin', 'restaurant_owner', 'user', 'delivery_man']);
  });

  test('marks name, email, password and role as required', () => {
    const requiredFields: Record<string, boolean> = {};
    for (const field of ['name', 'email', 'password', 'role'] as const) {
      requiredFields[field] = schema.paths[field]?.isRequired === true;
    }
    expect(requiredFields).toEqual({ name: true, email: true, password: true, role: true });
  });

  test('restricts role to the enum values', () => {
    expect(schema.paths['role']?.options?.enum).toEqual(expect.arrayContaining(Object.values(UserRole)));
  });
});

describe('validateOrderDetails', () => {
  const valid = { id: 'o1', customer: { name: 'Alice', address: 'Colombo 06' }, total: 12.5 };

  test('accepts a valid payload', () => {
    expect(validateOrderDetails(valid)).toBe(true);
  });

  test.each([
    [{}, 'empty object'],
    [null, 'null'],
    [{ ...valid, id: '' }, 'empty id'],
    [{ ...valid, id: 'x'.repeat(65) }, 'id too long'],
    [{ ...valid, total: -1 }, 'negative total'],
    [{ ...valid, total: 1e9 + 1 }, 'total too large'],
    [{ ...valid, total: '12' }, 'non-numeric total'],
    [{ ...valid, customer: { name: '', address: 'B' } }, 'empty customer name'],
    [{ ...valid, customer: { name: 'A', address: '' } }, 'empty customer address'],
    [{ ...valid, customer: 'A' }, 'customer not an object'],
  ])('rejects %s', (payload, _label) => {
    expect(validateOrderDetails(payload)).toBe(false);
  });
});

describe('sanitizeEmailField (NOTIF-05 header injection defence)', () => {
  test('strips CRLF sequences entirely', () => {
    expect(sanitizeEmailField('Alice\r\nBcc: attacker@evil.com')).toBe('AliceBcc: attacker@evil.com');
    expect(sanitizeEmailField('A\r\nSubject: hacked')).toBe('ASubject: hacked');
  });

  test('collapses lone newlines to spaces', () => {
    expect(sanitizeEmailField('line1\nline2')).toBe('line1 line2');
  });

  test('keeps normal text unaltered', () => {
    expect(sanitizeEmailField('Bob 123 Main St')).toBe('Bob 123 Main St');
  });
});

describe('buildEmailMessage', () => {
  test('uses a fixed subject/from and embeds values in the body', () => {
    const msg = buildEmailMessage('o42', 'Charlie', 'Halstead', 99);
    expect(msg.subject).toBe('New Delivery Order'); // user input never reaches headers
    expect(msg.from).toEqual(expect.any(String));
    expect(msg.text).toContain('Order ID: o42');
    expect(msg.text).toContain('Customer: Charlie');
    expect(msg.text).toContain('Total: 99');
    expect(msg.text).toContain('Address: Halstead');
  });
});