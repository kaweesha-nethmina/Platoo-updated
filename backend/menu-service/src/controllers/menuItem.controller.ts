import { NextFunction, Request, Response } from 'express';
import { 
  createMenuItem, 
  getMenuItemsByCategory, 
  updateMenuItem, 
  deleteMenuItem, 
  getMenuItemsByRestaurant,
  getAllMenuItems,
  getMenuItemImage,
  getMenuItemById
} from '../services/menuItem.service';

// Create a new menu item (now associated with a category)
export const createMenuItemHandler = async (req: Request, res: Response, next?: NextFunction): Promise<void> => {
  try {

    // [FIX VULN-03] allow-list (unknown keys stripped) instead of req.body.
    const { category_id, name, description, price, image_url, is_veg, is_available } = req.body;
    const data = { category_id, name, description, price, image_url, is_veg, is_available };

    // Ensure price is always a number (VULN-04; model also enforces min: 0)
    if (data.price !== undefined && data.price !== null) {
      data.price = typeof data.price === 'number' ? data.price : parseFloat(data.price);
    }

    const menuItem = await createMenuItem(data);
    res.status(201).json(menuItem);
  } catch (error) {
    // [FIX VULN-07] delegate to central error handler — WAS: res.status(500).json({ error: error.message })
    next?.(error);
  }
};

// Get menu items by category ID
export const getMenuItemsByCategoryHandler = async (req: Request, res: Response, next?: NextFunction): Promise<void> => {
  try {
    const { categoryId } = req.params; // Extract category ID from URL params
    const menuItems = await getMenuItemsByCategory(categoryId);

    res.status(200).json(menuItems);
  } catch (error) {
    // [FIX VULN-07] delegate to central error handler — WAS: res.status(500).json({ error: error.message })
    next?.(error);
  }
};

// Update a menu item by ID
export const updateMenuItemHandler = async (req: Request, res: Response, next?: NextFunction): Promise<void> => {
  try {
    const { menuItemId } = req.params;

    // [FIX VULN-03] allow-list: only editable item fields accepted.
    // WAS: `req.body` passed straight through (mass assignment of
    // price / is_available / category_id — evidence EV-M2, TC-BB-045).
    const { category_id, name, description, price, image_url, is_veg, is_available } = req.body;
    const updatedData = { category_id, name, description, price, image_url, is_veg, is_available };

    // [FIX VULN-04] price is coerced to a number and the model enforces min: 0.
    if (updatedData.price !== undefined && updatedData.price !== null) {
      updatedData.price = typeof updatedData.price === 'number' ? updatedData.price : parseFloat(updatedData.price);
    }

    const updatedMenuItem = await updateMenuItem(menuItemId, updatedData);

    if (!updatedMenuItem) {
      res.status(404).json({ error: 'Menu item not found' });
      return;
    }

    res.status(200).json(updatedMenuItem);
  } catch (error) {
    // [FIX VULN-07] delegate to central error handler — WAS: res.status(500).json({ error: error.message })
    next?.(error);
  }
};

// Delete a menu item by ID
export const deleteMenuItemHandler = async (req: Request, res: Response, next?: NextFunction): Promise<void> => {
  try {
    const { menuItemId } = req.params;
    const deletedMenuItem = await deleteMenuItem(menuItemId);

    if (!deletedMenuItem) {
       res.status(404).json({ error: 'Menu item not found' });
       return; // [FIX VULN-11] WAS: missing return -> ERR_HTTP_HEADERS_SENT + 200
    }

    res.status(200).json({ message: 'Menu item deleted successfully' });
  } catch (error) {
    // [FIX VULN-07] delegate to central error handler — WAS: res.status(500).json({ error: error.message })
    next?.(error);
  }
};

// Get all menu items for a specific restaurant
export const getMenuItemsByRestaurantHandler = async (req: Request, res: Response, next?: NextFunction): Promise<void> => {
  try {
    const { restaurantId } = req.params; // Extract restaurant ID from URL params
    const menuItems = await getMenuItemsByRestaurant(restaurantId);

    res.status(200).json(menuItems);
  } catch (error) {
    // [FIX VULN-07] delegate to central error handler — WAS: res.status(500).json({ error: error.message })
    next?.(error);
  }
};

// Get all menu items from all restaurants
export const getAllMenuItemsHandler = async (req: Request, res: Response, next?: NextFunction): Promise<void> => {
  try {
    const menuItems = await getAllMenuItems();
    res.status(200).json(menuItems);
  } catch (error) {
    // [FIX VULN-07] delegate to central error handler — WAS: res.status(500).json({ error: error.message })
    next?.(error);
  }
};

// Get only the image URL of a menu item by ID
export const getMenuItemImageHandler = async (req: Request, res: Response, next?: NextFunction): Promise<void> => {
  try {
    const { menuItemId } = req.params;

    // Fetch the image URL using the service function
    const image = await getMenuItemImage(menuItemId);

    if (!image) {
      res.status(404).json({ error: 'Menu item or image not found' });
      return;
    }

    // Return only the image URL
    res.status(200).json(image);
  } catch (error) {
    // [FIX VULN-07] delegate to central error handler — WAS: res.status(500).json({ error: error.message })
    next?.(error);
  }
};

// [FIX VULN-04] lookup endpoint: cart-service (and the front-end) fetch the
// authoritative item record (price/name/image) from here — used instead of a
// client-controlled price.
export const getMenuItemByIdHandler = async (req: Request, res: Response, next?: NextFunction): Promise<void> => {
  try {
    const { menuItemId } = req.params;
    const item = await getMenuItemById(menuItemId);

    if (!item) {
      res.status(404).json({ error: 'Menu item not found' });
      return;
    }

    res.status(200).json(item);
  } catch (error) {
    // [FIX VULN-07] delegate to central error handler — WAS: res.status(500).json({ error: error.message })
    next?.(error);
  }
};
