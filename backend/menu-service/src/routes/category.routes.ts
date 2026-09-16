import express from 'express';
import { 
  createCategoryHandler, 
  getCategoriesByRestaurantHandler, 
  updateCategoryHandler, 
  deleteCategoryHandler,
  getAllCategoriesHandler 
} from '../controllers/category.controller'; // Updated import

const router = express.Router();

router.post('/', createCategoryHandler); // Create a new category
router.get('/:restaurantId', getCategoriesByRestaurantHandler); // Get categories by restaurant ID
router.put('/:categoryId', updateCategoryHandler); // Update a category by ID
router.delete('/:categoryId', deleteCategoryHandler); // Delete a category by ID
router.get('/', getAllCategoriesHandler); // Get all categories from all restaurants

export default router;