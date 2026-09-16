const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const ADMIN_EMAIL = "admin@platoo.com";
const ADMIN_PASSWORD = "admin123";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, required: true },
  phone: String,
  address: String,
  restaurantName: String,
  vehicleNumber: String,
  createdAt: { type: Date, default: Date.now },
});
const User = mongoose.model("User", userSchema);

(async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGO_URI not found in .env");
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log("Connected to MongoDB");

  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const result = await User.findOneAndUpdate(
    { email: ADMIN_EMAIL },
    { $set: { name: "Admin", password: hashedPassword, role: "admin" } },
    { upsert: true, new: true }
  );

  console.log("Admin ready:", { id: result._id, email: result.email, role: result.role });

  const count = await User.countDocuments({ role: "admin" });
  console.log("Total admin users in DB:", count);

  await mongoose.disconnect();
})().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});