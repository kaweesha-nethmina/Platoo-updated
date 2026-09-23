/**
 * NOTIFICATION-SERVICE - UNIT tests: controller.
 * Mocks the notification service and validation module so the route handler's
 * status-code branching (400 invalid, 200 success, 500 provider failure) is
 * covered without any DB / network.
 */
import type { Response, Request } from 'express';
import { sendDeliveryNotification } from '../../src/controllers/notificationController';
import { notifyDeliveryPersons } from '../../src/services/notificationService';
import { validateOrderDetails } from '../../src/utils/validation';

jest.mock('../../src/services/notificationService', () => ({
  notifyDeliveryPersons: jest.fn(),
}));

jest.mock('../../src/utils/validation', () => ({
  validateOrderDetails: jest.fn(),
}));

const mockNotify = notifyDeliveryPersons as jest.MockedFunction<typeof notifyDeliveryPersons>;
const mockValidate = validateOrderDetails as jest.MockedFunction<typeof validateOrderDetails>;

function makeRes(): Response {
  const res = { statusCode: 0, body: undefined, status: jest.fn(), json: jest.fn() } as unknown as Response;
  (res.status as jest.Mock).mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  (res.json as jest.Mock).mockImplementation((body: unknown) => {
    (res as Response & { body: unknown }).body = body;
    return res;
  });
  return res;
}

const validBody = {
  orderDetails: { id: 'o1', customer: { name: 'Alice', address: 'Colombo' }, total: 10 },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockValidate.mockReturnValue(true);
});

describe('sendDeliveryNotification controller', () => {
  test('returns 400 with a JSON error when orderDetails is missing', async () => {
    mockValidate.mockReturnValue(false);
    const res = makeRes();
    const req = { body: {} } as Request;
    await sendDeliveryNotification(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect((res as Response & { body: unknown }).body).toEqual({ error: 'Invalid order details' });
    expect(mockNotify).not.toHaveBeenCalled();
  });

  test('returns 400 when payload fails validation', async () => {
    mockValidate.mockReturnValue(false);
    const res = makeRes();
    const req = { body: { orderDetails: { id: '' } } } as Request;
    await sendDeliveryNotification(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 200 with the service result on success', async () => {
    mockNotify.mockResolvedValue({ success: true, message: 'ok', delivered: 3 });
    const res = makeRes();
    const req = { body: validBody, user: { id: 'u1', role: 'admin' } } as unknown as Request;
    await sendDeliveryNotification(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect((res as Response & { body: unknown }).body).toEqual({ success: true, message: 'ok', delivered: 3 });
    expect(mockNotify).toHaveBeenCalledWith(validBody.orderDetails);
  });

  test('returns 500 JSON (not a crash) when the provider fails', async () => {
    mockNotify.mockRejectedValue(new Error('smtp down'));
    const res = makeRes();
    const req = { body: validBody } as Request;
    await sendDeliveryNotification(req, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect((res as Response & { body: unknown }).body).toEqual({ error: 'Failed to send notifications' });
  });
});