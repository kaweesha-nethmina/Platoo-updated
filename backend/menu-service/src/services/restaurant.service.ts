import RestaurantModel, { IRestaurant } from '../models/restaurant.model';
import CategoryModel from '../models/category.model';
import MenuItemModel from '../models/menuItem.model';

// Create a new restaurant
export const createRestaurant = async (data: any) => {
  return await RestaurantModel.create(data);
};

// Get all restaurants
export const getRestaurants = async () => {
  return await RestaurantModel.find({ is_active: true });
};

// Update a Restaurant
export const updateRestaurant = async (restaurantId: string, updatedData: Partial<IRestaurant>) => {
  return await RestaurantModel.findByIdAndUpdate(
    restaurantId,
    { $set: updatedData },
    { new: true } // Return the updated document
  );
};

// Delete a Restaurant
export const deleteRestaurant = async (restaurantId: string) => {
  return await RestaurantModel.findByIdAndDelete(restaurantId);
};

// Fetch a single restaurant by ID
export const getRestaurantById = async (restaurantId: string): Promise<IRestaurant | null> => {
  try {
    const restaurant = await RestaurantModel.findById(restaurantId);
    return restaurant;
  } catch (error) {
    throw error;
  }
};

// Fetch restaurant details including categories and menu items
export const getRestaurantWithCategoriesAndMenuItems = async (restaurantId: string) => {
  try {
    const categories = await CategoryModel.find({ restaurant_id: restaurantId, is_active: true });
    const categoryIds = categories.map((category) => category._id);
    const menuItems = await MenuItemModel.find({
      category_id: { $in: categoryIds },
      is_available: true,
    });
    return { categories, menuItems };
  } catch (error) {
    throw error;
  }
};
// Fetch restaurants by owner_id
export const getRestaurantsByOwnerId = async (owner_id: string) => {
  return await RestaurantModel.find({ owner_id }); // Filter restaurants by owner_id
};