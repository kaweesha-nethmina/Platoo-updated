// src/geo-location-service/services/realTimeTracking.ts
import { Server } from 'socket.io';
import http from 'http';
import { Location } from '../models/location';
import mongoose from 'mongoose';

export const setupSocketIO = (server: http.Server): void => {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || '*',
      methods: ['GET', 'POST']
    }
  });

  // Handle socket connections
  io.on('connection', (socket) => {
    console.log('New client connected');

    // Driver updates their location
    socket.on('driver:updateLocation', async (data) => {
      try {
        const { driverId, latitude, longitude, orderId } = data;
        
        if (!driverId || !latitude || !longitude) {
          return;
        }

        // Update driver location in database
        await Location.findOneAndUpdate(
          { userId: new mongoose.Types.ObjectId(driverId), type: 'driver' },
          { 
            coordinates: {
              type: 'Point',
              coordinates: [longitude, latitude]
            },
            lastUpdated: new Date()
          },
          { new: true, upsert: true }
        );

        // If this update is for a specific order, notify clients tracking that order
        if (orderId) {
          io.to(`order_${orderId}`).emit('driver:locationUpdated', {
            driverId,
            latitude,
            longitude,
            timestamp: Date.now()
          });
        }
      } catch (error) {
        console.error('Error updating driver location:', error);
      }
    });

    // Client tracking an order
    socket.on('order:track', (orderId) => {
      socket.join(`order_${orderId}`);
      console.log(`Client joined tracking room for order ${orderId}`);
    });

    // Admin monitoring all drivers
    socket.on('admin:monitorDrivers', () => {
      socket.join('admin_monitoring');
    });

    // Broadcast all driver locations to admins periodically
    setInterval(async () => {
      try {
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
        const activeDrivers = await Location.find({
          type: 'driver',
          lastUpdated: { $gte: fifteenMinutesAgo }
        }).populate('userId', 'name');

        io.to('admin_monitoring').emit('admin:driversUpdate', activeDrivers);
      } catch (error) {
        console.error('Error fetching active drivers for admin:', error);
      }
    }, 10000); // Every 10 seconds

    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });
  });
};