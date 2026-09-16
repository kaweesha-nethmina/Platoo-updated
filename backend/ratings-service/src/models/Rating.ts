import mongoose, { Document, Schema } from 'mongoose';

export interface IRating extends Document {
  customerId: string;
  restaurantId: string;
  orderId: string;
  rating: number;
  review?: string;
  createdAt: Date;
}

const ratingSchema = new Schema<IRating>({
  customerId: { type: String, required: true },
  restaurantId: { type: String, required: true },
  orderId: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  review: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const RatingModel = mongoose.model<IRating>('Rating', ratingSchema);
export default RatingModel;