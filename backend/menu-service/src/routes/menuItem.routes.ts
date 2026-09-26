import express from 'express';
import { 
  createMenuItemHandler, 
  getMenuItemsByCategoryHandler, 
  updateMenuItemHandler, 
  deleteMenuItemHandler,
  getMenuItemsByRestaurantHandler, // Import the new handler
  getAllMenuItemsHandler, // Import the new handler
  getMenuItemImageHandler,
  getMenuItemByIdHandler // [FIX VULN-04] authoritative catalogue lookup
} from '../controllers/menuItem.controller';
import { requireAuth } from '../middleware/auth'; // [FIX VULN-01]

const router = express.Router();

router.post('/', requireAuth, createMenuItemHandler); // Create a new menu item [FIX VULN-01]
router.get('/category/:categoryId', getMenuItemsByCategoryHandler); // Get menu items by category ID
router.put('/:menuItemId', requireAuth, updateMenuItemHandler); // Update a menu item by ID [FIX VULN-01]
router.delete('/:menuItemId', requireAuth, deleteMenuItemHandler); // Delete a menu item by ID [FIX VULN-01]
router.get('/restaurant/:restaurantId', getMenuItemsByRestaurantHandler); // Get menu items by restaurant ID
router.get('/', getAllMenuItemsHandler); // Get all menu items from all restaurants
router.get('/:menuItemId/image', getMenuItemImageHandler); // Get only the image URL of a menu item
router.get('/:menuItemId', getMenuItemByIdHandler); // [FIX VULN-04] authoritative item lookup (must come after /category & /restaurant)

export default router;