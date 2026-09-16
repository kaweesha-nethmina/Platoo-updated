import { Request, Response } from 'express';
import {
  createRestaurant,
  getRestaurants,
  updateRestaurant,
  deleteRestaurant,
  getRestaurantById,
  getRestaurantWithCategoriesAndMenuItems,
  getRestaurantsByOwnerId
} from '../services/restaurant.service';

// Create a new restaurant
export const createRestaurantHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { owner_id, name, image, rating, deliveryTime, deliveryFee, minOrder, distance, cuisines, priceLevel, location, open_time, closed_time } = req.body;

    const restaurantData = {
      owner_id, // Use owner_id from the request body
      name,
      image,
      rating,
      deliveryTime,
      deliveryFee,
      minOrder,
      distance,
      cuisines,
      priceLevel,
      location,
      open_time,
      closed_time
    };

    const restaurant = await createRestaurant(restaurantData);
    res.status(201).json(restaurant); // Do not use 'return' here
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'An unknown error occurred' });
    }
  }
};

// Get all restaurants
export const getRestaurantsHandler = async (_: Request, res: Response): Promise<void> => {
  try {
    const restaurants = await getRestaurants();
    res.status(200).json(restaurants); // Do not use 'return' here
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'An unknown error occurred' });
    }
  }
};

// Update a restaurant by ID
export const updateRestaurantHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params;
    const updatedData = req.body;
    const updatedRestaurant = await updateRestaurant(restaurantId, updatedData);

    if (!updatedRestaurant) {
      res.status(404).json({ error: 'Restaurant not found' });
      return; // Use 'return' to exit early
    }

    res.status(200).json(updatedRestaurant); // Do not use 'return' here
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'An unknown error occurred' });
    }
  }
};

// PATCH: Update the owner_id of a restaurant
export const updateRestaurantOwnerHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params; // Extract restaurant ID from URL params
    const { owner_id } = req.body; // Get the new owner_id from the request body

    if (!owner_id) {
      res.status(400).json({ error: 'Owner ID is required' });
      return;
    }

    // Find the restaurant by ID and update the owner_id
    const updatedRestaurant = await updateRestaurant(restaurantId, { owner_id });

    if (!updatedRestaurant) {
      res.status(404).json({ error: 'Restaurant not found' });
      return;
    }

    res.status(200).json(updatedRestaurant);
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'An unknown error occurred' });
    }
  }
};

// Delete a restaurant by ID
export const deleteRestaurantHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params;
    const deletedRestaurant = await deleteRestaurant(restaurantId);

    if (!deletedRestaurant) {
      res.status(404).json({ error: 'Restaurant not found' });
      return; // Use 'return' to exit early
    }

    res.status(200).json({ message: 'Restaurant deleted successfully' }); // Do not use 'return' here
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'An unknown error occurred' });
    }
  }
};

// Get a single restaurant by ID
export const getRestaurantByIdHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params; // Extract restaurant ID from URL params
    const restaurant = await getRestaurantById(restaurantId);

    if (!restaurant) {
      res.status(404).json({ error: 'Restaurant not found' });
      return;
    }

    res.status(200).json(restaurant);
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'An unknown error occurred' });
    }
  }
};

// Get restaurant's categories and menu items
export const getRestaurantWithCategoriesAndMenuItemsHandler = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { restaurantId } = req.params; // Extract restaurant ID from URL params

    // Fetch categories and menu items for the restaurant
    const result = await getRestaurantWithCategoriesAndMenuItems(restaurantId);

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'An unknown error occurred' });
    }
  }
};

// Get restaurants by owner_id
// Get restaurants by owner_id
export const getRestaurantsByOwnerIdHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ownerId } = req.params; // Access owner_id from the route parameters

    // Fetch restaurants that belong to the owner
    const restaurants = await getRestaurantsByOwnerId(ownerId);

    res.status(200).json(restaurants);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};