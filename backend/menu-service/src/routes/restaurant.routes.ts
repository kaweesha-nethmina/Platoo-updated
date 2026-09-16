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

const router = express.Router();

// Create a new restaurant
router.post('/', createRestaurantHandler);

// Get all restaurants
router.get('/', getRestaurantsHandler);

// Update a restaurant by ID
router.put('/:restaurantId', updateRestaurantHandler); // Update a restaurant by ID

// Update restaurant owner_id
router.patch('/:restaurantId/owner', updateRestaurantOwnerHandler); // Update owner_id of a restaurant

// Delete a restaurant by ID
router.delete('/:restaurantId', deleteRestaurantHandler);

// Get a single restaurant by ID
router.get('/:restaurantId', getRestaurantByIdHandler);

// Get restaurant's categories and menu items
router.get('/:restaurantId/details', getRestaurantWithCategoriesAndMenuItemsHandler);

// New route to get restaurants by owner_id (as route parameter)
router.get('/owner/:ownerId', getRestaurantsByOwnerIdHandler); // Fetch restaurants by owner_id

export default router;
