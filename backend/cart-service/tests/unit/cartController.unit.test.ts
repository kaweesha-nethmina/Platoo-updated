/**
 * UNIT tests - cart-service cartController.ts (SE4030 / SSD).
 * CartModel is fully mocked (constructor + static findOne). No DB, no network.
 * Covers the quantity-merge/add/remove/update business logic in isolation,
 * boundary quantity/price values, and every error branch.
 */
import { CartModel } from '../../src/models/cartModel';
import {
  addItemToCart,
  removeItemFromCart,
  getCartByUserId,
  updateCartItemQuantity,
} from '../../src/controllers/cartController';

jest.mock('../../src/models/cartModel', () => {
  const cartConstructor = jest.fn();
  (cartConstructor as any).findOne = jest.fn();
  return { CartModel: cartConstructor, __esModule: true };
});

const CartModelMock = CartModel as any;
const findOneMock = CartModelMock.findOne as jest.Mock;

const mockRes = () =>
  ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  }) as any;

const mockReq = (body: any = {}, params: any = {}) => ({ body, params }) as any;

const baseItem = {
  productId: 'prod-1',
  name: 'Margherita Pizza',
  price: 1200,
  quantity: 2,
  image: 'http://localhost:3001/uploads/m.png',
};

const makeCart = (userId = 'user-A', items: any[] = []) => ({
  userId,
  items: items.map((i) => ({ ...i })),
  createdAt: new Date(),
  updatedAt: new Date(),
  save: jest.fn().mockResolvedValue(undefined),
});

/** Constructor mock that acts like a real "new CartModel({ userId, items })" store. */
const installConstructorMock = () => {
  CartModelMock.mockImplementation((data: any) => {
    const cart = makeCart(data.userId, data.items);
    createdCarts.push(cart);
    return cart;
  });
  createdCarts.length = 0;
};

let createdCarts: any[] = [];

beforeEach(() => {
  createdCarts.length = 0;
});

describe('cartController.addItemToCart (POST /api/cart/add)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    installConstructorMock();
  });

  it('UNIT-C-ADD-001 existing item: quantity INCREMENTS (2 + 3 = 5), price/name NOT overwritten', async () => {
    const existing = makeCart('u1', [baseItem]); // price 1200, name Margherita
    findOneMock.mockResolvedValue(existing);
    const res = mockRes();

    await addItemToCart(mockReq({ userId: 'u1', ...baseItem, quantity: 3, price: 1, name: 'Hacker Name' }), res);

    expect(existing.items[0].quantity).toBe(5);
    expect(existing.items[0].price).toBe(1200); // merge ignores client price change
    expect(existing.items[0].name).toBe('Margherita Pizza'); // merge ignores client name change
    expect(existing.save).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(existing);
  });

  it('UNIT-C-ADD-002 new productId for an existing cart → item APPENDED (with image field)', async () => {
    const existing = makeCart('u1', [baseItem]);
    findOneMock.mockResolvedValue(existing);
    const res = mockRes();

    await addItemToCart(mockReq({ userId: 'u1', productId: 'prod-2', name: 'Cola', price: 250, quantity: 1, image: 'http://x/c.png' }), res);

    expect(existing.items).toHaveLength(2);
    expect(existing.items[1]).toMatchObject({ productId: 'prod-2', name: 'Cola', price: 250, quantity: 1, image: 'http://x/c.png' });
    expect(existing.save).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('UNIT-C-ADD-003 first item for a brand-new user → cart created via new CartModel', async () => {
    findOneMock.mockResolvedValue(null);
    const res = mockRes();

    await addItemToCart(mockReq({ userId: 'new-user', ...baseItem }), res);

    expect(CartModelMock).toHaveBeenCalledWith({ userId: 'new-user', items: [] });
    expect(createdCarts).toHaveLength(1);
    expect(createdCarts[0].items[0]).toMatchObject({ productId: 'prod-1', quantity: 2 });
    expect(createdCarts[0].save).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(createdCarts[0]);
  });

  it('UNIT-C-ADD-004 image is optional → item stored without image when omitted', async () => {
    const existing = makeCart('u1', []);
    findOneMock.mockResolvedValue(existing);
    const res = mockRes();

    const { image, ...noImage } = baseItem;
    await addItemToCart(mockReq({ userId: 'u1', ...noImage }), res);

    // image key is pushed (as undefined) — no image value stored
    expect(existing.items[0]).toHaveProperty('image', undefined);
  });

  it('UNIT-C-ADD-005 boundary: quantity 0 is accepted by controller (per-item has no server-side min:1 guard at this layer)', async () => {
    const existing = makeCart('u1', [baseItem]);
    findOneMock.mockResolvedValue(existing);
    const res = mockRes();

    await addItemToCart(mockReq({ userId: 'u1', ...baseItem, quantity: 0 }), res);
    expect(existing.items[0].quantity).toBe(2); // 2 + 0
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('UNIT-C-ADD-006 boundary: negative quantity accepted by controller (validation deferred to mongoose → 500 in integration)', async () => {
    const existing = makeCart('u1', [baseItem]);
    findOneMock.mockResolvedValue(existing);
    const res = mockRes();

    await addItemToCart(mockReq({ userId: 'u1', ...baseItem, quantity: -5 }), res);
    expect(existing.items[0].quantity).toBe(-3);
  });

  it('UNIT-C-ADD-007 boundary: huge quantity accepted by controller (no upper limit)', async () => {
    const existing = makeCart('u1', [baseItem]);
    findOneMock.mockResolvedValue(existing);
    const res = mockRes();

    await addItemToCart(mockReq({ userId: 'u1', ...baseItem, quantity: 1_000_000 }), res);
    expect(existing.items[0].quantity).toBe(1_000_002);
  });

  it('UNIT-C-ADD-008 empty/missing body → cart created with undefined fields (no validation)', async () => {
    findOneMock.mockResolvedValue(null);
    const res = mockRes();

    await addItemToCart(mockReq({}), res);
    expect(createdCarts[0].items[0]).toEqual({ productId: undefined, name: undefined, price: undefined, quantity: undefined, image: undefined });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('UNIT-C-ADD-009 price as string passes through verbatim (client-controlled)', async () => {
    const existing = makeCart('u1', []);
    findOneMock.mockResolvedValue(existing);
    const res = mockRes();

    await addItemToCart(mockReq({ userId: 'u1', ...baseItem, price: '0.01' }), res);
    expect(existing.items[0].price).toBe('0.01');
  });

  it('UNIT-C-ADD-010 DB failure → 500 { message: "Error adding item to cart", error }', async () => {
    const boom = new Error('connection refused');
    findOneMock.mockRejectedValue(boom);
    const res = mockRes();

    await addItemToCart(mockReq({ userId: 'u1', ...baseItem }), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Error adding item to cart', error: boom });
  });
});

describe('cartController.removeItemFromCart (POST /api/cart/remove)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('UNIT-C-REM-001 existing cart: matching item FILTERED OUT, save + 200', async () => {
    const cart = makeCart('u1', [baseItem, { ...baseItem, productId: 'prod-2' }]);
    findOneMock.mockResolvedValue(cart);
    const res = mockRes();

    await removeItemFromCart(mockReq({ userId: 'u1', productId: 'prod-1' }), res);
    expect(cart.items.map((i: any) => i.productId)).toEqual(['prod-2']);
    expect(cart.save).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(cart);
  });

  it('UNIT-C-REM-002 cart not found → 404 "Cart not found", save never called', async () => {
    findOneMock.mockResolvedValue(null);
    const res = mockRes();

    await removeItemFromCart(mockReq({ userId: 'nobody', productId: 'x' }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Cart not found' });
    expect(createdCarts).toHaveLength(0); // no cart was constructed/saved
  });

  it('UNIT-C-REM-003 removing a product that is NOT in the cart → 200 with unchanged items (no error)', async () => {
    const cart = makeCart('u1', [baseItem]);
    findOneMock.mockResolvedValue(cart);
    const res = mockRes();

    await removeItemFromCart(mockReq({ userId: 'u1', productId: 'ghost' }), res);
    expect(cart.items).toHaveLength(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('UNIT-C-REM-004 DB failure → 500', async () => {
    findOneMock.mockRejectedValue(new Error('db'));
    const res = mockRes();
    await removeItemFromCart(mockReq({ userId: 'u1', productId: 'x' }), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Error removing item from cart', error: expect.any(Error) });
  });
});

describe('cartController.getCartByUserId (GET /api/cart/:userId)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('UNIT-C-GET-001 existing cart → 200 with cart', async () => {
    const cart = makeCart('u1', [baseItem]);
    findOneMock.mockResolvedValue(cart);
    const res = mockRes();

    await getCartByUserId(mockReq({}, { userId: 'u1' }), res);
    expect(findOneMock).toHaveBeenCalledWith({ userId: 'u1' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(cart);
  });

  it('UNIT-C-GET-002 no cart → 404 "Cart not found"', async () => {
    findOneMock.mockResolvedValue(null);
    const res = mockRes();
    await getCartByUserId(mockReq({}, { userId: 'nobody' }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('UNIT-C-GET-003 DB failure → 500', async () => {
    findOneMock.mockRejectedValue(new Error('db'));
    const res = mockRes();
    await getCartByUserId(mockReq({}, { userId: 'u1' }), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('cartController.updateCartItemQuantity (POST /api/cart/update)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('UNIT-C-UPD-001 existing item → quantity REPLACED, save + 200', async () => {
    const cart = makeCart('u1', [baseItem]);
    findOneMock.mockResolvedValue(cart);
    const res = mockRes();

    await updateCartItemQuantity(mockReq({ userId: 'u1', productId: 'prod-1', quantity: 7 }), res);
    expect(cart.items[0].quantity).toBe(7);
    expect(cart.save).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('UNIT-C-UPD-002 cart not found → 404 "Cart not found"', async () => {
    findOneMock.mockResolvedValue(null);
    const res = mockRes();
    await updateCartItemQuantity(mockReq({ userId: 'nobody', productId: 'x', quantity: 1 }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Cart not found' });
  });

  it('UNIT-C-UPD-003 item not in cart → 404 "Item not found in cart"', async () => {
    const cart = makeCart('u1', [baseItem]);
    findOneMock.mockResolvedValue(cart);
    const res = mockRes();
    await updateCartItemQuantity(mockReq({ userId: 'u1', productId: 'ghost', quantity: 1 }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Item not found in cart' });
  });

  it('UNIT-C-UPD-004 boundary: quantity 0 accepted by controller (no guard here; mongoose min:1 causes 500 in integration)', async () => {
    const cart = makeCart('u1', [baseItem]);
    findOneMock.mockResolvedValue(cart);
    const res = mockRes();
    await updateCartItemQuantity(mockReq({ userId: 'u1', productId: 'prod-1', quantity: 0 }), res);
    expect(cart.items[0].quantity).toBe(0);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('UNIT-C-UPD-005 boundary: negative quantity accepted by controller', async () => {
    const cart = makeCart('u1', [baseItem]);
    findOneMock.mockResolvedValue(cart);
    const res = mockRes();
    await updateCartItemQuantity(mockReq({ userId: 'u1', productId: 'prod-1', quantity: -9 }), res);
    expect(cart.items[0].quantity).toBe(-9);
  });

  it('UNIT-C-UPD-006 boundary: string quantity accepted by controller (defect: no cast → CastError 500 in integration)', async () => {
    const cart = makeCart('u1', [baseItem]);
    findOneMock.mockResolvedValue(cart);
    const res = mockRes();
    await updateCartItemQuantity(mockReq({ userId: 'u1', productId: 'prod-1', quantity: '9' }), res);
    expect(cart.items[0].quantity).toBe('9');
  });

  it('UNIT-C-UPD-007 DB failure → 500', async () => {
    findOneMock.mockRejectedValue(new Error('db'));
    const res = mockRes();
    await updateCartItemQuantity(mockReq({ userId: 'u1', productId: 'x', quantity: 1 }), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Error updating cart item quantity', error: expect.any(Error) });
  });
});