import { Request, Response } from 'express';
import axios from 'axios';
import RestaurantModel from '../models/restaurant.model';
import { searchMenuItems } from '../services/search.service';
import { sanitizeSearchParam, sanitizePlainText, sanitizePagination } from '../utils/sanitize';

// Base URL of the Menu Service
const MENU_SERVICE_URL = 'http://localhost:3001';

// Handle Restaurant Search
export const handleRestaurantSearch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { query, location, cuisine, page, limit } = req.query;

    // SRCH-01: reject non-string/operator-object values before they reach MongoDB.
    const safeQuery = sanitizeSearchParam(query);
    const safeLocation = sanitizeSearchParam(location);
    const safeCuisine = sanitizeSearchParam(cuisine);

    // SRCH-03: page/limit are clamped (limit max 100) so a request can never
    // materialise an unbounded result set; the query also gets a time cap.
    const pageInfo = sanitizePagination({ page, limit });

    // Validate query parameters
    if (!safeQuery && !safeLocation && !safeCuisine) {
      res.status(400).json({ message: 'At least one search parameter is required' });
      return;
    }

    // Build the query object
    const searchQuery: Record<string, { $regex: string; $options: string }> = {};

    // SRCH-02: safeQuery is regex-escaped by sanitizeSearchParam.
    if (safeQuery) {
      searchQuery.name = { $regex: safeQuery, $options: 'i' }; // Search by restaurant name (case-insensitive)
    }

    if (safeLocation) {
      searchQuery['location.tag'] = { $regex: `^${safeLocation}$`, $options: 'i' }; // Exact match for location tag
    }

    if (safeCuisine) {
      searchQuery.cuisines = { $regex: safeCuisine, $options: 'i' }; // Match cuisine
    }

    // Fetch restaurants with applied filters
    const restaurants = await RestaurantModel.find(searchQuery)
      .skip((pageInfo.page - 1) * pageInfo.limit)
      .limit(pageInfo.limit)
      .maxTimeMS(2000);

    // If no restaurants found, return empty array
    if (restaurants.length === 0) {
      res.status(404).json({ message: 'No restaurants found' });
      return;
    }

    // Send the response
    res.status(200).json(restaurants);
  } catch (error: unknown) {
    console.error("Error fetching restaurants:", error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const handleMenuItemSearch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { query } = req.query;

    const safeQuery = sanitizeSearchParam(query);

    // Validate query parameter
    if (!safeQuery) {
      res.status(400).json({ message: 'Query parameter is required' });
      return; 
    }

    // Call the service to get the filtered menu items
    const filteredMenuItems = await searchMenuItems(safeQuery);

    if (filteredMenuItems.length > 0) {
      res.status(200).json(filteredMenuItems);
    } else {
      res.status(404).json({ message: 'No menu items found' });
    }

  } catch (error: unknown) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Handle Category Search
export const handleCategorySearch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { query } = req.query;

    const safeQuery = sanitizePlainText(query);

    if (!safeQuery) {
      res.status(400).json({ message: 'Query parameter is required' });
      return;
    }

    try {
      // Fetch all categories from Menu Service
      const response = await axios.get(`${MENU_SERVICE_URL}/api/category`);

      const categories = response.data;

      // Filter categories based on the query name (case-insensitive)
      const filteredCategories = categories.filter((category: { name: string }) =>
        category.name.toLowerCase() === safeQuery.toLowerCase()
      );

      if (filteredCategories.length > 0) {
        res.status(200).json(filteredCategories);
      } else {
        res.status(404).json({ message: 'Category not found' });
      }
    } catch (error: unknown) {
      const detail = axios.isAxiosError(error) ? error.response?.data || error.message : 'unknown error';
      console.error('Error fetching category details:', detail);
      res.status(500).json({ message: 'Error fetching category details' });
    }
  } catch (error: unknown) {
    console.error('Unknown error during category search:', error instanceof Error ? error.message : error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

