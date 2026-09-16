import { Router } from 'express';
import {
  addItemToCart,
  removeItemFromCart,
  getCartByUserId,
  updateCartItemQuantity,
} from '../controllers/cartController';

const router = Router();

// Add item to cart
router.post('/add', addItemToCart);

// Remove item from cart
router.post('/remove', removeItemFromCart);

// Get cart by user ID
router.get('/:userId', getCartByUserId);

// Update cart item quantity
router.post('/update', updateCartItemQuantity);

export default router;