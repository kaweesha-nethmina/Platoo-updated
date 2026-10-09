// src/geo-location-service/services/realTimeTracking.ts
import { Server } from 'socket.io';
import http from 'http';
import jwt from 'jsonwebtoken';
import { Location } from '../models/location';
import { UserPayload } from '../middleware/auth';
import { isValidCoordinatePair, isValidOrderId } from '../utils/geoValidation';

const CLIENT_ORIGINS = process.env.CLIENT_URL ? [process.env.CLIENT_URL] : ['http://localhost:8000'];

export const setupSocketIO = (server: http.Server): void => {
  const io = new Server(server, {
    cors: {
      origin: CLIENT_ORIGINS,
      methods: ['GET', 'POST'],
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      return next(new Error('Unauthorized: No token provided'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as UserPayload;
      socket.data.user = { id: decoded.id, role: decoded.role };
      next();
    } catch (error) {
      next(new Error('Unauthorized: Invalid token'));
    }
  });

  // Handle socket connections
  io.on('connection', (socket) => {
    console.log('New client connected');
    const user = socket.data.user as UserPayload;

    // Driver updates their location
    socket.on('driver:updateLocation', async (data) => {
      try {
        if (!user || user.role !== 'delivery_man') {
          return;
        }

        const { latitude, longitude, orderId } = data;
        const lat = Number(latitude);
        const lng = Number(longitude);

        if (!isValidCoordinatePair(lat, lng)) {
          return;
        }

        const driverId = user.id;

        // Update driver location in database (identity pinned to the verified token subject)
        await Location.findOneAndUpdate(
          { userId: driverId, type: 'driver' },
          {
            coordinates: {
              type: 'Point',
              coordinates: [lng, lat],
            },
            lastUpdated: new Date(),
          },
          { new: true, upsert: true }
        );

        // If this update is for a specific order, notify clients tracking that order
        if (orderId && isValidOrderId(orderId)) {
          io.to(`order_${orderId}`).emit('driver:locationUpdated', {
            driverId,
            latitude: lat,
            longitude: lng,
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        console.error('Error updating driver location:', error);
      }
    });

    // Client tracking an order
    socket.on('order:track', (orderId) => {
      if (!user) return;
      if (user.role === 'admin' || user.role === 'delivery_man') {
        if (isValidOrderId(orderId)) {
          socket.join(`order_${orderId}`);
          console.log(`Client joined tracking room for order ${orderId}`);
        }
      }
    });

    // Admin monitoring all drivers
    socket.on('admin:monitorDrivers', () => {
      if (user && user.role === 'admin') {
        socket.join('admin_monitoring');
      }
    });

    // Broadcast all driver locations to admins periodically
    setInterval(async () => {
      try {
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
        const activeDrivers = await Location.find({
          type: 'driver',
          lastUpdated: { $gte: fifteenMinutesAgo },
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