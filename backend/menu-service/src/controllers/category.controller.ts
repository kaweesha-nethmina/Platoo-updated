import { NextFunction, Request, Response } from 'express';
import { 
  createCategory, 
  getCategoriesByRestaurant, 
  updateCategory, 
  deleteCategory, 
  getAllCategories
} from '../services/category.service'; // Updated import

// Create a new category
export const createCategoryHandler = async (req: Request, res: Response, next?: NextFunction): Promise<void> => {
  try {
    // [FIX VULN-03] allow-list (unknown keys stripped) instead of req.body.
    const { restaurant_id, name, description, image_url, is_active } = req.body;
    const data = { restaurant_id, name, description, image_url, is_active };
    const category = await createCategory(data);
    res.status(201).json(category);
  } catch (error) {
    // [FIX VULN-07] delegate to central error handler — WAS: res.status(500).json({ error: error.message })
    next?.(error);
  }
};

// Get categories by restaurant ID
export const getCategoriesByRestaurantHandler = async (req: Request, res: Response, next?: NextFunction): Promise<void> => {
  try {
    const categories = await getCategoriesByRestaurant(req.params.restaurantId);
    res.status(200).json(categories);
  } catch (error) {
    // [FIX VULN-07] delegate to central error handler — WAS: res.status(500).json({ error: error.message })
    next?.(error);
  }
};

// Update a category by ID
export const updateCategoryHandler = async (req: Request, res: Response, next?: NextFunction): Promise<void> => {
  try {
    const { categoryId } = req.params;

    // [FIX VULN-03] allow-list: only editable category fields accepted.
    // WAS: `req.body` passed straight through (mass assignment).
    const { name, description, image_url, is_active } = req.body;
    const updatedData = { name, description, image_url, is_active };

    const updatedCategory = await updateCategory(categoryId, updatedData);

    if (!updatedCategory) {
       res.status(404).json({ error: 'Category not found' });
       return; // [FIX VULN-11] prevent double-response / ERR_HTTP_HEADERS_SENT
    }

    res.status(200).json(updatedCategory);
  } catch (error) {
    // [FIX VULN-07] delegate to central error handler — WAS: res.status(500).json({ error: error.message })
    next?.(error);
  }
};

// Delete a category by ID
export const deleteCategoryHandler = async (req: Request, res: Response, next?: NextFunction): Promise<void> => {
  try {
    const { categoryId } = req.params;
    const deletedCategory = await deleteCategory(categoryId);

    if (!deletedCategory) {
       res.status(404).json({ error: 'Category not found' });
       return; // [FIX VULN-11] WAS: missing return -> ERR_HTTP_HEADERS_SENT + 200
    }

    res.status(200).json({ message: 'Category deleted successfully' });
  } catch (error) {
    // [FIX VULN-07] delegate to central error handler — WAS: res.status(500).json({ error: error.message })
    next?.(error);
  }
};

// Get all categories from all restaurants
export const getAllCategoriesHandler = async (req: Request, res: Response, next?: NextFunction): Promise<void> => {
  try {
    const categories = await getAllCategories();
    res.status(200).json(categories);
  } catch (error) {
    // [FIX VULN-07] delegate to central error handler — WAS: res.status(500).json({ error: error.message })
    next?.(error);
  }
};