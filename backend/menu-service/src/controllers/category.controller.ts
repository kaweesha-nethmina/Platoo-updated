import { Request, Response } from 'express';
import { 
  createCategory, 
  getCategoriesByRestaurant, 
  updateCategory, 
  deleteCategory, 
  getAllCategories
} from '../services/category.service'; // Updated import

// Create a new category
export const createCategoryHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const category = await createCategory(req.body);
    res.status(201).json(category);
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'An unknown error occurred' });
    }
  }
};

// Get categories by restaurant ID
export const getCategoriesByRestaurantHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const categories = await getCategoriesByRestaurant(req.params.restaurantId);
    res.status(200).json(categories);
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'An unknown error occurred' });
    }
  }
};

// Update a category by ID
export const updateCategoryHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { categoryId } = req.params;
    const updatedData = req.body;
    const updatedCategory = await updateCategory(categoryId, updatedData);

    if (!updatedCategory) {
       res.status(404).json({ error: 'Category not found' });
    }

    res.status(200).json(updatedCategory);
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'An unknown error occurred' });
    }
  }
};

// Delete a category by ID
export const deleteCategoryHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { categoryId } = req.params;
    const deletedCategory = await deleteCategory(categoryId);

    if (!deletedCategory) {
       res.status(404).json({ error: 'Category not found' });
    }

    res.status(200).json({ message: 'Category deleted successfully' });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'An unknown error occurred' });
    }
  }
};

// Get all categories from all restaurants
export const getAllCategoriesHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const categories = await getAllCategories();
    res.status(200).json(categories);
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'An unknown error occurred' });
    }
  }
};