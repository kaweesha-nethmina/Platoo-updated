import { Router } from 'express';
import {
  handleRestaurantSearch,
  handleCategorySearch,
  handleMenuItemSearch,
} from '../controllers/search.controller';

const router = Router();

// Search Restaurants
router.get('/restaurants', handleRestaurantSearch);

// Search Categories
router.get('/categories', handleCategorySearch);

// Search Menu Items
router.get('/menu-items', handleMenuItemSearch);

export default router;