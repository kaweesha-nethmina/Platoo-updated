import express from 'express';
import { 
  createMenuItemHandler, 
  getMenuItemsByCategoryHandler, 
  updateMenuItemHandler, 
  deleteMenuItemHandler,
  getMenuItemsByRestaurantHandler, // Import the new handler
  getAllMenuItemsHandler, // Import the new handler
  getMenuItemImageHandler
} from '../controllers/menuItem.controller';

const router = express.Router();

router.post('/', createMenuItemHandler); // Create a new menu item
router.get('/category/:categoryId', getMenuItemsByCategoryHandler); // Get menu items by category ID
router.put('/:menuItemId', updateMenuItemHandler); // Update a menu item by ID
router.delete('/:menuItemId', deleteMenuItemHandler); // Delete a menu item by ID
router.get('/restaurant/:restaurantId', getMenuItemsByRestaurantHandler); // Get menu items by restaurant ID
router.get('/', getAllMenuItemsHandler); // Get all menu items from all restaurants
router.get('/:menuItemId/image', getMenuItemImageHandler); // Get only the image URL of a menu item

export default router;