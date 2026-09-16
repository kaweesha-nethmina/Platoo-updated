import mongoose, { Schema, Document } from 'mongoose';

export interface IOrderItem {
  menu_item_id: mongoose.Types.ObjectId;
  quantity: number;
  price: number;
}

export interface IOrder extends Document {
  order_id: string;
  user_id: string;
  total_amount: number;
  status: string;
  items: IOrderItem[];
  restaurant_id: string;
  delivery_fee: number; // Added delivery_fee
  delivery_address: string; // Added delivery_address field
  phone: string; // Added phone field
  email: string; // Added email field
  location: { lat: number; lng: number };
}

const orderSchema: Schema = new Schema(
  {
    order_id: { type: String, required: true, unique: true },
    user_id: { type: String, required: true },
    total_amount: { type: Number, required: true },
    status: { type: String, default: 'pending' },
    items: [
      {
        menu_item_id: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
      },
    ],
    restaurant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    delivery_fee: { type: Number, default: 0 }, // Delivery fee with a default value
    delivery_address: { type: String, required: true }, // Delivery address
    phone: { type: String, required: true }, // Phone number
    email: { type: String, required: true }, // Email address
    location: {
      type: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
      },
      required: true,
    }, // New field for location
  },
  { timestamps: true }
);

// Auto-generate the `order_id` before saving the order
orderSchema.pre('save', async function (next) {
  if (!this.order_id) {
    const count = await mongoose.model('Order').countDocuments();
    this.order_id = `ORD${(count + 1).toString().padStart(3, '0')}`;
  }
  next();
});

export default mongoose.model<IOrder>('Order', orderSchema);
