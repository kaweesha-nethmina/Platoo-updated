import express from 'express';
import { 
  createRestaurantHandler, 
  getRestaurantsHandler, 
  updateRestaurantHandler,
  updateRestaurantOwnerHandler, // Import the new handler
  deleteRestaurantHandler,
  getRestaurantByIdHandler,
  getRestaurantWithCategoriesAndMenuItemsHandler,
  getRestaurantsByOwnerIdHandler
} from '../controllers/restaurant.controller';
import { requireAuth } from '../middleware/auth'; // [FIX VULN-01]

const router = express.Router();

// Create a new restaurant  [FIX VULN-01] WAS: no auth on any mutation
router.post('/', requireAuth, createRestaurantHandler);

// Get all restaurants
router.get('/', getRestaurantsHandler);

// Update a restaurant by ID
router.put('/:restaurantId', requireAuth, updateRestaurantHandler); // Update a restaurant by ID

// Update restaurant owner_id
router.patch('/:restaurantId/owner', requireAuth, updateRestaurantOwnerHandler); // Update owner_id of a restaurant

// Delete a restaurant by ID
router.delete('/:restaurantId', requireAuth, deleteRestaurantHandler);

// Get a single restaurant by ID
router.get('/:restaurantId', getRestaurantByIdHandler);

// Get restaurant's categories and menu items
router.get('/:restaurantId/details', getRestaurantWithCategoriesAndMenuItemsHandler);

// New route to get restaurants by owner_id (as route parameter)
router.get('/owner/:ownerId', getRestaurantsByOwnerIdHandler); // Fetch restaurants by owner_id

export default router;
