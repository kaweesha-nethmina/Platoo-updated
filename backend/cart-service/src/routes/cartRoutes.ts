import { Router } from 'express';
import {
  addItemToCart,
  removeItemFromCart,
  getCartByUserId,
  updateCartItemQuantity,
} from '../controllers/cartController';
import { requireAuth } from '../middlewares/auth'; // [FIX VULN-02]

const router = Router();

// [FIX VULN-02] every cart endpoint now requires a valid HS256 token — WAS:
// no auth → any client could read/modify anyone's cart (TC-BB-064/069/075).
router.post('/add', requireAuth, addItemToCart);
router.post('/remove', requireAuth, removeItemFromCart);
router.get('/:userId', requireAuth, getCartByUserId);
router.post('/update', requireAuth, updateCartItemQuantity);

export default router;