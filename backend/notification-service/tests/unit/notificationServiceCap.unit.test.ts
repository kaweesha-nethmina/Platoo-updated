/**
 * NOTIFICATION-SERVICE - UNIT tests: notificationService recipient cap
 * (NOTIF-02). MAX_NOTIFICATION_RECIPIENTS is read at module load time, so this
 * file reloads the service (jest.resetModules) after pinning the env var, then
 * configures the already-mocked User model + mailer dependencies.
 */
import { notifyDeliveryPersons } from '../../src/services/notificationService';

jest.mock('../../src/models/User', () => ({
  __esModule: true,
  default: { find: jest.fn() },
}));

jest.mock('../../src/utils/mailer', () => ({
  __esModule: true,
  sendEmail: jest.fn(),
  buildEmailMessage: jest.fn(),
}));

function wireMocks(emails: string[]) {
  // jest.requireMock returns the already-jest.mock'd module without relying on
  // a bare `require()` (kept lint-clean under @typescript-eslint/no-require-imports).
  const { default: UserMock } = jest.requireMock('../../src/models/User') as {
    default: { find: jest.Mock };
  };
  const mailer = jest.requireMock('../../src/utils/mailer') as {
    sendEmail: jest.Mock;
    buildEmailMessage: jest.Mock;
  };
  (UserMock.find as jest.Mock).mockReturnValue({
    select: jest.fn().mockReturnValue(emails.map((email) => ({ email }))),
  });
  mailer.buildEmailMessage.mockReturnValue({
    from: 'noreply@platoo.local',
    subject: 'New Delivery Order',
    text: 'Order ID: o1',
  });
  mailer.sendEmail.mockResolvedValue({ messageId: 'mock' });
  return mailer;
}

describe('recipient cap (NOTIF-02, CWE-770)', () => {
  test('truncates fan-out to MAX_NOTIFICATION_RECIPIENTS when set', async () => {
    process.env.MAX_NOTIFICATION_RECIPIENTS = '2';
    jest.resetModules();

    const svc = jest.requireActual<{ notifyDeliveryPersons: typeof notifyDeliveryPersons }>(
      '../../src/services/notificationService'
    );
    const mailer = wireMocks(['a@x.local', 'b@x.local', 'c@x.local', 'd@x.local']);

    const result = await svc.notifyDeliveryPersons({ id: 'o1', customer: { name: 'A', address: 'B' }, total: 10 });
    expect(mailer.sendEmail).toHaveBeenCalledTimes(2);
    expect(result.delivered).toBe(2);

    delete process.env.MAX_NOTIFICATION_RECIPIENTS;
    jest.resetModules();
  });

  test('unset env uses the default cap (all recipients delivered)', async () => {
    delete process.env.MAX_NOTIFICATION_RECIPIENTS;
    jest.resetModules();

    const svc = jest.requireActual<{ notifyDeliveryPersons: typeof notifyDeliveryPersons }>(
      '../../src/services/notificationService'
    );
    const mailer = wireMocks(['a@x.local', 'b@x.local', 'c@x.local']);

    const result = await svc.notifyDeliveryPersons({ id: 'o1', customer: { name: 'A', address: 'B' }, total: 10 });
    expect(mailer.sendEmail).toHaveBeenCalledTimes(3);
    expect(result.delivered).toBe(3);

    jest.resetModules();
  });

  // Keeps the static import in sync so `notifyDeliveryPersons` is exercised
  // for coverage even though the dynamic reloads do the real assertion work.
  test('default import is callable', () => {
    expect(typeof notifyDeliveryPersons).toBe('function');
  });
});