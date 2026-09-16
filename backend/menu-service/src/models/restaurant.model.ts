import mongoose, { Schema, Document } from 'mongoose';

export interface IRestaurant extends Document {
  id: string; // Maps to MongoDB's `_id`
  name: string;
  image: string;
  rating: number;
  deliveryTime: string;
  deliveryFee: string;
  minOrder: string;
  distance: string;
  cuisines: string[];
  priceLevel: number;
  is_active: boolean;
  location: {
    type: 'Point'; // GeoJSON type for coordinates
    coordinates: [number, number]; // [longitude, latitude]
    tag: string; // Location tag (e.g., "kalutara")
  };
  open_time: string; // New field for opening time
  closed_time: string; // New field for closing time
  owner_id: string; // New field for the restaurant owner ID
}

const RestaurantSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    image: { type: String, required: true },
    rating: { type: Number, default: 0 },
    deliveryTime: { type: String, required: true },
    deliveryFee: { type: String, required: true },
    minOrder: { type: String, required: true },
    distance: { type: String, required: true },
    cuisines: { type: [String], required: true },
    priceLevel: { type: Number, required: true },
    is_active: { type: Boolean, default: true },
    location: {
      type: {
        type: String,
        enum: ['Point'], // Only 'Point' is allowed
        required: true,
      },
      coordinates: {
        type: [Number], // Array of [longitude, latitude]
        required: true,
      },
      tag: {
        type: String,
        required: true,
      },
    },
    open_time: { type: String, default: '08:00 AM' }, // Default opening time
    closed_time: { type: String, default: '10:00 PM' }, // Default closing time
    owner_id: { type: String, required: true }, // New field for the restaurant owner ID
  },
  { timestamps: true }
);

// Add a 2dsphere index for geospatial queries
RestaurantSchema.index({ 'location.coordinates': '2dsphere' });

export default mongoose.model<IRestaurant>('Restaurant', RestaurantSchema);
