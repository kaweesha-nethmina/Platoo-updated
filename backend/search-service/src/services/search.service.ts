import axios from 'axios';

const MENU_SERVICE_URL = process.env.MENU_SERVICE_URL || 'http://localhost:3001';

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
  } catch (error: unknown) {
    console.error('Error fetching menu items:', error);
    throw error;
  }
};
