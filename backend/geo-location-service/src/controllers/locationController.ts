// src/controllers/locationController.ts
import { Response, NextFunction } from 'express';
import { Location } from '../models/location';
import axios from 'axios';
import { isValidCoordinatePair } from '../utils/geoValidation';
import { AuthRequest } from '../middleware/auth';

interface DirectionsCacheEntry {
  expiresAt: number;
  payload: Record<string, unknown>;
}

const directionsCache = new Map<string, DirectionsCacheEntry>();
const CACHE_TTL_MS = 60 * 1000;

const ALLOWED_TYPES = ['user', 'restaurant', 'driver'];

// 🔹 Add Location
export const addLocation = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { type, latitude, longitude, address } = req.body;

    if (!userId || !type || !ALLOWED_TYPES.includes(type)) {
      res.status(400).json({ error: 'Missing or invalid fields' });
      return;
    }

    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!isValidCoordinatePair(lat, lng) || typeof address !== 'string' || address.trim() === '') {
      res.status(400).json({ error: 'Invalid coordinates or address' });
      return;
    }

    const location = await Location.create({
      userId,
      type,
      address,
      coordinates: {
        type: 'Point',
        coordinates: [lng, lat],
      },
      lastUpdated: new Date(),
    });

    res.status(201).json(location);
  } catch (error) {
    next(error);
  }
};

// 🔹 Update Location By ID
export const updateLocationById = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;
    const currentUser = req.user;

    if (!currentUser) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (currentUser.role !== 'admin' && currentUser.id !== userId) {
      res.status(403).json({ error: 'Forbidden: You can only update your own location' });
      return;
    }

    if (!/^[a-fA-F0-9]{24}$/.test(userId)) {
      res.status(400).json({ error: 'Invalid userId format' });
      return;
    }

    const { latitude, longitude, address } = req.body;
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!isValidCoordinatePair(lat, lng) || typeof address !== 'string' || address.trim() === '') {
      res.status(400).json({ error: 'Invalid coordinates or address' });
      return;
    }

    const updated = await Location.findOneAndUpdate(
      { userId },
      {
        address,
        coordinates: { type: 'Point', coordinates: [lng, lat] },
        lastUpdated: new Date(),
      },
      { new: true }
    );

    if (!updated) {
      res.status(404).json({ error: 'Location not found' });
    } else {
      res.status(200).json(updated);
    }
  } catch (error) {
    next(error);
  }
};

// 🔹 Get All Locations
export const getAllLocations = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const query = currentUser.role === 'admin' ? {} : { userId: currentUser.id };
    const locations = await Location.find(query).populate('userId', 'name type');
    res.status(200).json(locations);
  } catch (error) {
    next(error);
  }
};

// 🔹 Get Directions Between Two Points
export const getDirections = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { originLat, originLng, destinationLat, destinationLng } = req.query;
    const lat1 = Number(originLat);
    const lng1 = Number(originLng);
    const lat2 = Number(destinationLat);
    const lng2 = Number(destinationLng);

    if (!isValidCoordinatePair(lat1, lng1) || !isValidCoordinatePair(lat2, lng2)) {
      res.status(400).json({ error: 'Invalid coordinates' });
      return;
    }

    const key = [lat1, lng1, lat2, lng2].join(',');
    const cached = directionsCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      res.status(200).json(cached.payload);
      return;
    }

    const response = await axios.get(
      `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}`,
      {
        params: {
          overview: 'full',
          geometries: 'polyline',
          steps: 'true',
        },
        timeout: 10000,
      }
    );

    if (response.data.code === 'Ok' && response.data.routes.length) {
      const route = response.data.routes[0];
      const payload = {
        summary: route.legs[0]?.summary || 'Route',
        legs: route.legs,
        polyline: route.geometry,
      };
      directionsCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
      res.status(200).json(payload);
    } else {
      res.status(404).json({ message: 'Directions not found' });
    }
  } catch (error) {
    next(error);
  }
};