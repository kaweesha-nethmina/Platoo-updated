import { Request, Response } from 'express';
import axios from 'axios';
import RestaurantModel from '../models/restaurant.model';

// Base URL of the Menu Service
const MENU_SERVICE_URL = 'http://localhost:3001';

// Handle Restaurant Search
export const handleRestaurantSearch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { query, location, cuisine } = req.query;

    // Validate query parameters
    if (!query && !location && !cuisine) {
      res.status(400).json({ message: 'At least one search parameter is required' });
      return;
    }

    // Build the query object to send to the Menu Service
    const searchQuery: any = {};

    if (query) {
      searchQuery.$or = [
        { name: { $regex: query, $options: 'i' } }, // Match restaurant name
        { cuisines: { $regex: query, $options: 'i' } }, // Match cuisines
      ];
    }

    if (location) {
      searchQuery['location.tag'] = { $regex: `^${location}$`, $options: 'i' }; // Exact match for location tag
    }

    if (cuisine) {
      searchQuery.cuisines = { $regex: cuisine, $options: 'i' }; // Match cuisine
    }

    // Fetch restaurants from the database
    const restaurants = await RestaurantModel.find(searchQuery);

    // Send the response
    res.status(200).json(restaurants);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const searchRestaurants = async (
  query: string,
  location?: string,
  category?: string,
  cuisine?: string
) => {
  const results: any[] = [];

  // Step 1: Search Restaurants
  if (query || location || cuisine) {
    const restaurantQuery: any = {};

    // Build the restaurant query
    if (query) {
      restaurantQuery.$or = [
        { name: { $regex: query, $options: 'i' } },
        { cuisines: { $regex: query, $options: 'i' } },
      ];
    }

    if (location) {
      restaurantQuery['location.tag'] = { $regex: `^${location}$`, $options: 'i' }; // Exact match for location tag
    }

    if (cuisine) {
      restaurantQuery.cuisines = { $regex: cuisine, $options: 'i' };
    }

    // Fetch matching restaurants
    const restaurants = await RestaurantModel.find(restaurantQuery).limit(10);
    results.push(...restaurants);
  }

  return results;
};


export const searchMenuItems = async (query: string) => {
  try {
    // Fetch menu items from the Menu Service
    const response = await axios.get(`${MENU_SERVICE_URL}/api/menu-items`, {
      params: { query },
    });

    // Filter the menu items to only include exact matches for the query (case-insensitive)
    return response.data.filter((menuItem: { name: string }) =>
      menuItem.name.toLowerCase() === query.toLowerCase() // Exact match filtering
    );
  } catch (error: any) {
    console.error('Error fetching menu items:', error);
    throw error;
  }
};

