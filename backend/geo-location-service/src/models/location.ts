import mongoose, { Document, Schema } from 'mongoose';

export interface ILocation extends Document {
  userId: mongoose.Types.ObjectId;
  type: 'user' | 'restaurant' | 'driver';
  address: string;
  coordinates: {
    type: string;
    coordinates: number[];
  };
  lastUpdated: Date;
}

const LocationSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  type: { type: String, enum: ['user', 'restaurant', 'driver'], required: true },
  address: { type: String, required: true },
  coordinates: {
    type: {
      type: String,
      enum: ['Point'],
      required: true
    },
    coordinates: {
      type: [Number],
      required: true
    }
  },
  lastUpdated: { type: Date, default: Date.now }
});

LocationSchema.index({ coordinates: '2dsphere' });

export const Location = mongoose.model<ILocation>('Location', LocationSchema);
