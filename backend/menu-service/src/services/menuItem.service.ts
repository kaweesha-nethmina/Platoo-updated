import MenuItemModel, { IMenuItem } from '../models/menuItem.model'; // Import remains the same
import CategoryModel from '../models/category.model';

export const createMenuItem = async (data: any) => {
  return await MenuItemModel.create(data);
};

// Fetch all menu items for a specific category
export const getMenuItemsByCategory = async (categoryId: string): Promise<IMenuItem[]> => {
  try {
    const menuItems = await MenuItemModel.find({ category_id: categoryId, is_available: true });

    return menuItems;
  } catch (error) {
    throw error;
  }
};
// Update a menu item
export const updateMenuItem = async (menuItemId: string, updatedData: Partial<IMenuItem>) => {
    return await MenuItemModel.findByIdAndUpdate(
      menuItemId,
      { $set: updatedData },
      { new: true } // Return the updated document
    );
  };
  
  // Delete a menu item
  export const deleteMenuItem = async (menuItemId: string) => {
    return await MenuItemModel.findByIdAndDelete(menuItemId);
  };

  // Fetch all menu items for a specific restaurant
export const getMenuItemsByRestaurant = async (restaurantId: string): Promise<IMenuItem[]> => {
  try {
    // Find categories associated with the restaurant
    const categories = await CategoryModel.find({ restaurant_id: restaurantId });

    // Extract category IDs
    const categoryIds = categories.map((category) => category._id);

    // Find menu items associated with the category IDs
    const menuItems = await MenuItemModel.find({ category_id: { $in: categoryIds }, is_available: true });

    return menuItems;
  } catch (error) {
    throw error;
  }
};

// Fetch all menu items from all restaurants
export const getAllMenuItems = async (): Promise<IMenuItem[]> => {
  try {
    const menuItems = await MenuItemModel.find({ is_available: true })
      .populate('category_id', 'name'); // Optionally populate category details

    return menuItems;
  } catch (error) {
    throw error;
  }
};

// Fetch only the image URL of a menu item by ID
export const getMenuItemImage = async (menuItemId: string): Promise<{ image_url: string } | null> => {
  try {
    const menuItem = await MenuItemModel.findById(menuItemId, 'image_url');
    return menuItem ? { image_url: menuItem.image_url } : null;
  } catch (error) {
    throw error;
  }
};

