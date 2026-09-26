import { Request, Response } from 'express';
import { CartModel } from '../models/cartModel';
import { getProductById } from '../services/catalogue.service'; // [FIX VULN-04]

// [FIX VULN-02] identity must come from the verified token ONLY.
// WAS: userId read from req.body / req.params -> any client could act as any
// user (IDOR, EV-C1, TC-BB-064/069/075).
const identityOf = (req: Request): string => {
  const id = (req as any).user?.id ?? (req as any).user?.sub;
  return typeof id === 'string' ? id : '';
};

// [FIX VULN-02/05] reject requests with no usable identity (no token -> 401).
const requireIdentity = (req: Request, res: Response): string | null => {
  const userId = identityOf(req);
  if (typeof userId !== 'string' || !userId) {
    res.status(401).json({ message: 'Unauthorized' });
    return null;
  }
  return userId;
};

// [FIX VULN-07] WAS: `res.status(500).json({ message, error })` leaked the whole
// error object. Now controllers return a generic message; the central error
// handler produces typed responses.
const serverError = (res: Response, msg: string): void => {
  res.status(500).json({ message: msg });
};

// Add item to cart
export const addItemToCart = async (req: Request, res: Response): Promise<void> => {
  const userId = requireIdentity(req, res);
  if (!userId) return;

  const { productId, quantity } = req.body; // [FIX VULN-04] price/name/image NO LONGER accepted from the client

  // [FIX VULN-04] authoritative price fetched server-side from the menu/catalogue
  // service; a client-supplied price is never trusted (EV-C2, TC-BB-057/058).
  const catalogue = await getProductById(productId);
  if (!catalogue) {
    res.status(400).json({ message: 'Unknown product' });
    return;
  }

  // [FIX VULN-04] quantity must be a positive integer (TC-BB-059/060).
  if (!Number.isInteger(quantity) || quantity < 1) {
    res.status(400).json({ message: 'quantity must be a positive integer' });
    return;
  }

  try {
    let cart = await CartModel.findOne({ userId });

    if (!cart) {
      cart = new CartModel({ userId, items: [] });
    }

    const existingItem = cart.items.find((item) => item.productId === productId);

    if (existingItem) {
      existingItem.quantity += quantity;
      existingItem.price = catalogue.price; // keep server price authoritative
    } else {
      cart.items.push({
        productId,
        name: catalogue.name,
        price: catalogue.price,
        quantity,
        image: catalogue.image_url,
      });
    }

    cart.updatedAt = new Date();
    await cart.save();

    res.status(200).json(cart);
  } catch (error) {
    console.error(error);
    serverError(res, 'Error adding item to cart'); // [FIX VULN-07]
  }
};

// Remove item from cart
export const removeItemFromCart = async (req: Request, res: Response): Promise<void> => {
  const userId = requireIdentity(req, res);
  if (!userId) return;

  const { productId } = req.body;

  try {
    const cart = await CartModel.findOne({ userId });

    if (!cart) {
      res.status(404).json({ message: 'Cart not found' });
      return;
    }

    cart.items = cart.items.filter((item) => item.productId !== productId);
    cart.updatedAt = new Date();
    await cart.save();

    res.status(200).json(cart);
    return;
  } catch (error) {
    console.error(error);
    serverError(res, 'Error removing item from cart'); // [FIX VULN-07]
    return;
  }
};

// Get cart by user ID
export const getCartByUserId = async (req: Request, res: Response): Promise<void> => {
  const userId = requireIdentity(req, res); // [FIX VULN-02] identity from token, NOT from :userId (IDOR)
  if (!userId) return;

  try {
    const cart = await CartModel.findOne({ userId });

    if (!cart) {
      res.status(404).json({ message: 'Cart not found' });
      return;
    }

    res.status(200).json(cart);
  } catch (error) {
    console.error(error);
    serverError(res, 'Error fetching cart'); // [FIX VULN-07]
  }
};

// Update cart item quantity
export const updateCartItemQuantity = async (req: Request, res: Response): Promise<void> => {
  const userId = requireIdentity(req, res);
  if (!userId) return;

  const { productId, quantity } = req.body;

  // [FIX VULN-04] quantity must be a positive integer (TC-BB-074).
  if (!Number.isInteger(quantity) || quantity < 1) {
    res.status(400).json({ message: 'quantity must be a positive integer' });
    return;
  }

  try {
    const cart = await CartModel.findOne({ userId });

    if (!cart) {
      res.status(404).json({ message: 'Cart not found' });
      return;
    }

    const item = cart.items.find((item) => item.productId === productId);

    if (!item) {
      res.status(404).json({ message: 'Item not found in cart' });
      return;
    }

    item.quantity = quantity;
    cart.updatedAt = new Date();
    await cart.save();

    res.status(200).json(cart);
    return;
  } catch (error) {
    console.error(error);
    serverError(res, 'Error updating cart item quantity'); // [FIX VULN-07]
    return;
  }
};