// import mongoose, { Document, Schema } from "mongoose";

// export interface IDelivery extends Document {
//   orderId: string;
//   customerName: string;
//   deliveryAddress: string;
//   restaurantName: string;
//   deliveryStatus: string; // "pending", "assigned", "delivered"
//   pickupTime: Date;
//   deliveryTime: Date;
//   assignedTo: string | null; // Delivery man ID (null if not assigned)
// }

// const deliverySchema: Schema = new Schema(
//   {
//     orderId: { type: String, required: true },
//     customerName: { type: String, required: true },
//     deliveryAddress: { type: String, required: true },
//     restaurantName: { type: String, required: true },
//     deliveryStatus: { type: String, default: "pending" }, // Default to "pending"
//     pickupTime: { type: Date, required: true },
//     deliveryTime: { type: Date, required: true },
//     assignedTo: { type: String, default: null }, // Initially not assigned
//   },
//   { timestamps: true }
// );

// const Delivery = mongoose.model<IDelivery>("Delivery", deliverySchema);

// export default Delivery;
import mongoose, { Document, Schema } from "mongoose";

export interface IDelivery extends Document {
  orderId: string;
  customerName: string;
  deliveryAddress: string;
  restaurantName: string;
  deliveryStatus: string; // "pending", "assigned", "delivered"
  pickupTime: Date;
  deliveryTime: Date;
  assignedTo: string | null; // Delivery man ID (null if not assigned)
  earnings: number;
  deliveredAt?: Date;
}

const deliverySchema: Schema = new Schema(
  {
    orderId: { type: String, required: true },
    customerName: { type: String, required: true },
    deliveryAddress: { type: String, required: true },
    restaurantName: { type: String, required: true },
    deliveryStatus: { type: String, default: "pending" }, // Default to "pending"
    pickupTime: { type: Date, required: true },
    deliveryTime: { type: Date, required: true },
    assignedTo: { type: String, default: null },
    earnings: { type: Number, default: 0 },
    deliveredAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const Delivery = mongoose.model<IDelivery>("Delivery", deliverySchema);

export default Delivery;
