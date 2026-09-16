import { Request, Response } from 'express';
import { CartModel, ICartItem } from '../models/cartModel';

// Add item to cart
export const addItemToCart = async (req: Request, res: Response): Promise<void> => {
  const { userId, productId, name, price, quantity, image } = req.body;  // Accept image in the request body

  try {
    let cart = await CartModel.findOne({ userId });

    if (!cart) {
      cart = new CartModel({ userId, items: [] });
    }

    const existingItem = cart.items.find((item) => item.productId === productId);

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      cart.items.push({ productId, name, price, quantity, image });  // Add image to the item
    }

    cart.updatedAt = new Date();
    await cart.save();

    res.status(200).json(cart);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error adding item to cart', error });
  }
};


// Remove item from cart
export const removeItemFromCart = async (req: Request, res: Response): Promise<void> => {
  const { userId, productId } = req.body;

  try {
    const cart = await CartModel.findOne({ userId });

    if (!cart) {
      res.status(404).json({ message: 'Cart not found' });
      return;
    }

    cart.items = cart.items.filter((item) => item.productId !== productId);
    cart.updatedAt = new Date();
    await cart.save();

    // Avoid implicit return
    res.status(200).json(cart);
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error removing item from cart', error });
    return;
  }
};

// Get cart by user ID
export const getCartByUserId = async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.params;

  try {
    const cart = await CartModel.findOne({ userId });

    if (!cart) {
      res.status(404).json({ message: 'Cart not found' });
      return;
    }

    res.status(200).json(cart);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching cart', error });
  }
};


// Update cart item quantity
export const updateCartItemQuantity = async (req: Request, res: Response): Promise<void> => {
  const { userId, productId, quantity } = req.body;

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

    // Avoid implicit return
    res.status(200).json(cart);
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating cart item quantity', error });
    return;
  }
};