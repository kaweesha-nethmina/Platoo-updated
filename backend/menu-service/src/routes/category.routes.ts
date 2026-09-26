import express from 'express';
import { 
  createCategoryHandler, 
  getCategoriesByRestaurantHandler, 
  updateCategoryHandler, 
  deleteCategoryHandler,
  getAllCategoriesHandler 
} from '../controllers/category.controller'; // Updated import
import { requireAuth } from '../middleware/auth'; // [FIX VULN-01]

const router = express.Router();

router.post('/', requireAuth, createCategoryHandler); // Create a new category [FIX VULN-01]
router.get('/:restaurantId', getCategoriesByRestaurantHandler); // Get categories by restaurant ID
router.put('/:categoryId', requireAuth, updateCategoryHandler); // Update a category by ID [FIX VULN-01]
router.delete('/:categoryId', requireAuth, deleteCategoryHandler); // Delete a category by ID [FIX VULN-01]
router.get('/', getAllCategoriesHandler); // Get all categories from all restaurants

export default router;