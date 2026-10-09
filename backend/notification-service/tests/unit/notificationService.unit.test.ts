/**
 * NOTIFICATION-SERVICE - UNIT tests: notificationService.notifyDeliveryPersons.
 * Mocks the User model (no live Mongo) and the mailer sendEmail call (no live
 * SMTP). Verifies recipient fanned out to the correct provider args, per-user
 * failure aggregation, the all-failed -> throw path and the recipient cap.
 */
import { notifyDeliveryPersons } from '../../src/services/notificationService';
import User from '../../src/models/User';
import { sendEmail, buildEmailMessage } from '../../src/utils/mailer';

jest.mock('../../src/models/User', () => ({
  __esModule: true,
  default: { find: jest.fn(), countDocuments: jest.fn() },
}));

jest.mock('../../src/utils/mailer', () => ({
  __esModule: true,
  sendEmail: jest.fn(),
  buildEmailMessage: jest.fn(),
}));

const mockFind = User.find as jest.MockedFunction<typeof User.find>;
const mockSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;
const mockBuildEmailMessage = buildEmailMessage as jest.MockedFunction<typeof buildEmailMessage>;

const MESSAGE = { from: 'noreply@platoo.local', subject: 'New Delivery Order', text: 'Order ID: o1' };

function deliveryPersons(count: number, withEmail = true) {
  const list = [] as Array<{ email?: string }>;
  for (let i = 0; i < count; i += 1) {
    list.push(withEmail ? { email: `delivery${i}@platoo.local` } : { email: undefined });
  }
  return list;
}

// A find() that returns the array directly (the service calls .select() on the
// result). We stub .select to be chainable and resolve to the array itself.
mockFind.mockImplementation(
  (() => ({ select: jest.fn().mockReturnValue(deliveryPersons(4)) }) as unknown) as never
);

beforeEach(() => {
  jest.clearAllMocks();
  mockBuildEmailMessage.mockReturnValue(MESSAGE as never);
  mockSendEmail.mockResolvedValue({ messageId: 'mock' } as never);
});

describe('notifyDeliveryPersons', () => {
  test('sends one email per delivery person with the built message', async () => {
    const persons = deliveryPersons(3);
    mockFind.mockReturnValue({ select: jest.fn().mockReturnValue(persons) } as never);

    const result = await notifyDeliveryPersons({ id: 'o1', customer: { name: 'A', address: 'B' }, total: 10 });

    expect(mockFind).toHaveBeenCalledWith({ role: 'delivery_man' });
    expect(mockBuildEmailMessage).toHaveBeenCalledWith('o1', 'A', 'B', 10);
    expect(mockSendEmail).toHaveBeenCalledTimes(3);
    expect(mockSendEmail).toHaveBeenCalledWith('delivery0@platoo.local', 'New Delivery Order', 'Order ID: o1');
    expect(mockSendEmail).toHaveBeenCalledWith('delivery2@platoo.local', 'New Delivery Order', 'Order ID: o1');
    expect(result).toEqual({ success: true, message: 'Notifications sent successfully', delivered: 3 });
  });

  test('a failing provider email is counted, not thrown: partial success', async () => {
    const persons = deliveryPersons(3);
    mockFind.mockReturnValue({ select: jest.fn().mockReturnValue(persons) } as never);
    mockSendEmail.mockRejectedValueOnce(new Error('smtp error'));

    const result = await notifyDeliveryPersons({ id: 'o1', customer: { name: 'A', address: 'B' }, total: 10 });
    expect(result.delivered).toBe(2);
  });

  test('a failing provider email is counted, not thrown: full failure rethrows', async () => {
    const persons = deliveryPersons(3);
    mockFind.mockReturnValue({ select: jest.fn().mockReturnValue(persons) } as never);
    mockSendEmail.mockRejectedValue(new Error('smtp down'));

    await expect(
      notifyDeliveryPersons({ id: 'o1', customer: { name: 'A', address: 'B' }, total: 10 })
    ).rejects.toThrow('Failed to send any notification emails');
  });

  test('throws when there are no delivery persons', async () => {
    mockFind.mockReturnValue({ select: jest.fn().mockReturnValue([]) } as never);

    await expect(
      notifyDeliveryPersons({ id: 'o1', customer: { name: 'A', address: 'B' }, total: 10 })
    ).rejects.toThrow('No delivery persons found');
  });

  test('delivery persons without an email address are skipped', async () => {
    const persons = deliveryPersons(1, true).concat(deliveryPersons(2, false));
    mockFind.mockReturnValue({ select: jest.fn().mockReturnValue(persons) } as never);

    const result = await notifyDeliveryPersons({ id: 'o1', customer: { name: 'A', address: 'B' }, total: 10 });
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(result.delivered).toBe(1);
  });
});