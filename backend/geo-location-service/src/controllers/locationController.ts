// src/controllers/locationController.ts
import { Request, Response } from 'express';
import { Location } from '../models/location';
import axios from 'axios';
import mongoose from 'mongoose';

// 🔹 Add Location
export const addLocation = async (req: Request, res: Response): Promise<void> => {
    const { userId, type, latitude, longitude, address } = req.body;
  
    if (!userId || !type || !latitude || !longitude || !address) {
      res.status(400).json({ message: 'Missing fields' });
      return; // ✅ early return if validation fails
    }
  
    const location = await Location.create({
      userId,
      type,
      address,
      coordinates: {
        type: 'Point',
        coordinates: [longitude, latitude]
      },
      lastUpdated: new Date()
    });
  
    res.status(201).json(location);
    return; // ✅ return at end to satisfy Promise<void>
  };
  

// 🔹 Update Location By ID
export const updateLocationById = async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { latitude, longitude, address } = req.body;

  const updated = await Location.findOneAndUpdate(
    { userId },
    {
      address,
      coordinates: { type: 'Point', coordinates: [longitude, latitude] },
      lastUpdated: new Date()
    },
    { new: true }
  );

  if (!updated) {
    res.status(404).json({ message: 'Location not found' });
  } else {
    res.status(200).json(updated);
  }
  return; // Add this line to return void
};

// 🔹 Get All Locations
export const getAllLocations = async (_req: Request, res: Response) => {
  const locations = await Location.find().populate('userId', 'name type');
  res.status(200).json(locations);
};

// 🔹 Get Directions Between Two Points
export const getDirections = async (req: Request, res: Response) => {
  const { originLat, originLng, destinationLat, destinationLng } = req.query;

  const response = await axios.get(
    `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destinationLng},${destinationLat}`,
    {
      params: {
        overview: 'full',
        geometries: 'polyline',
        steps: 'true'
      }
    }
  );

  if (response.data.code === 'Ok' && response.data.routes.length) {
    const route = response.data.routes[0];
    res.status(200).json({
      summary: route.legs[0]?.summary || 'Route',
      legs: route.legs,
      polyline: route.geometry
    });
  } else {
    res.status(404).json({ message: 'Directions not found' });
  }
};
