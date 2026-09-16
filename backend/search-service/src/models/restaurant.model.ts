import mongoose, { Schema, Document } from 'mongoose';

export interface IRestaurant extends Document {
  name: string;
  location: string;
  categories: string[];
  cuisines: string[];
  menuItems: {
    name: string;
    price: number;
    category: string;
  }[];
}

const restaurantSchema = new Schema<IRestaurant>({
  name: { type: String, required: true },
  location: { type: String, required: true },
  categories: [{ type: String }],
  cuisines: [{ type: String }],
  menuItems: [
    {
      name: { type: String, required: true },
      price: { type: Number, required: true },
      category: { type: String, required: true },
    },
  ],
});

const RestaurantModel = mongoose.model<IRestaurant>('Restaurant', restaurantSchema);

export default RestaurantModel;