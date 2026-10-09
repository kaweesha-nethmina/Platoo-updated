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
  tax: number; // Server-computed tax (8% of item subtotal)
  delivery_address: string; // Added delivery_address field
  phone: string; // Added phone field
  email: string; // Added email field
  location: { lat: number; lng: number };
  payment_status: string;
  paid_at?: Date;
  idempotency_key?: string;
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
        name: { type: String }, // Persist the item name the checkout already sends -> history page needs it
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
      },
    ],
    restaurant_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    delivery_fee: { type: Number, default: 0 }, // Delivery fee with a default value
    tax: { type: Number, default: 0 }, // Server-computed tax (8% of item subtotal)
    delivery_address: { type: String, required: true }, // Delivery address
    phone: { type: String, required: true }, // Phone number
    email: { type: String, required: true }, // Email address
    payment_status: { type: String, enum: ['unpaid', 'paid'], default: 'unpaid' },
    paid_at: { type: Date },
    idempotency_key: { type: String }, // Replay protection: unique per (user_id, key)
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

// Query performance + idempotency enforcement: the same (user_id, idempotency_key)
// combination is unique so duplicate submissions can never create two orders.
// A partial index is used so legacy documents without a key are not constrained.
orderSchema.index({ user_id: 1 });
orderSchema.index(
  { user_id: 1, idempotency_key: 1 },
  { unique: true, partialFilterExpression: { idempotency_key: { $type: 'string' } } }
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
