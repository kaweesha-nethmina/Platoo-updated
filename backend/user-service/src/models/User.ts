// models/User.ts
import { Schema, model, Document } from "mongoose";

// Enum for user roles
export enum UserRole {
  ADMIN = "admin",
  RESTAURANT_OWNER = "restaurant_owner",
  USER = "user",
  DELIVERY_MAN = "delivery_man",
}

// Enum for auth providers
export enum AuthProvider {
  LOCAL = "local",
  GOOGLE = "google",
}

// Interface for user document
interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  googleId?: string;
  authProvider: AuthProvider;
  phone?: string;
  address?: string;
  restaurantName?: string;
  vehicleNumber?: string;
  createdAt: Date;
  location?: { lat: number; lng: number }; // New field for location
}

// Define the user schema
const userSchema = new Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: {
    type: String,
    required: function (this: IUser) {
      return this.authProvider !== AuthProvider.GOOGLE;
    },
    validate: {
      validator: function (this: IUser, value: string) {
        if (this.authProvider === AuthProvider.GOOGLE) return true;
        return typeof value === "string" && value.length > 0;
      },
      message: "Password is required for local accounts",
    },
  },
  role: { type: String, enum: Object.values(UserRole), required: true },
  googleId: { type: String, unique: true, sparse: true },
  authProvider: { type: String, enum: Object.values(AuthProvider), default: AuthProvider.LOCAL },
  phone: String,
  address: String,
  restaurantName: String,
  vehicleNumber: String,
  createdAt: { type: Date, default: Date.now },
  location: {
    type: {
      lat: { type: Number },
      lng: { type: Number },
    },
  }, // New field for location
});

// Export the user model
export default model<IUser>("User", userSchema);
