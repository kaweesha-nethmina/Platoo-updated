import CategoryModel, { ICategory } from '../models/category.model'; // Updated import

//create category
export const createCategory = async (data: any) => {
  return await CategoryModel.create(data);
};

export const getCategoriesByRestaurant = async (restaurantId: string) => {
  return await CategoryModel.find({ restaurant_id: restaurantId, is_active: true });
};

// Update a Category
export const updateCategory = async (categoryId: string, updatedData: Partial<ICategory>) => {
    return await CategoryModel.findByIdAndUpdate(
      categoryId,
      { $set: updatedData },
      { new: true } // Return the updated document
    );
  };
  
  // Delete a Category
  export const deleteCategory = async (categoryId: string) => {
    return await CategoryModel.findByIdAndDelete(categoryId);
  };
  
// Fetch all categories from all restaurants
export const getAllCategories = async (): Promise<ICategory[]> => {
  try {
    const categories = await CategoryModel.find().populate('restaurant_id', 'name'); // Optionally populate restaurant details
    return categories;
  } catch (error) {
    throw error;
  }
};