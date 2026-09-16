import mongoose, { Schema, Document } from 'mongoose';

export interface IMenuItem extends Document {
  category_id: mongoose.Types.ObjectId; // Changed from menu_id to category_id
  name: string;
  description: string;
  price: number; // Change here: price as a number
  image_url: string;
  is_veg: boolean;
  is_available: boolean;
}

const MenuItemSchema: Schema = new Schema(
  {
    category_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true }, // Changed reference to Category
    name: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true }, // Change here: price as a number
    image_url: { type: String, required: true },
    is_veg: { type: Boolean, default: false },
    is_available: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model<IMenuItem>('MenuItem', MenuItemSchema); // Model name remains the same
