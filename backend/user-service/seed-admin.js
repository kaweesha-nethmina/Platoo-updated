const path = require("path");
const crypto = require("crypto");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Admin email is not a secret, but the password must come from the environment
// or be generated at runtime — never hardcode it in source control.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@platoo.com";
const RESET_PASSWORD =
  process.env.ADMIN_RESET_PASSWORD === "1" ||
  process.env.ADMIN_RESET_PASSWORD === "true";

const generateStrongPassword = (length = 24) => {
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?";
  const bytes = crypto.randomBytes(length);
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset[bytes[i] % charset.length];
  }
  return password;
};

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

  const existing = await User.findOne({ email: ADMIN_EMAIL });

  // Only change the password when there is no user yet, when an explicit
  // ADMIN_PASSWORD is supplied, or when a reset was requested. This prevents
  // accidental re-runs from rotating the admin password silently.
  const shouldSetPassword =
    !existing || !existing.password || Boolean(process.env.ADMIN_PASSWORD) || RESET_PASSWORD;

  if (shouldSetPassword) {
    const adminPassword = process.env.ADMIN_PASSWORD || generateStrongPassword();
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    await User.findOneAndUpdate(
      { email: ADMIN_EMAIL },
      { $set: { name: "Admin", password: hashedPassword, role: "admin" } },
      { upsert: true, new: true }
    );

    if (!process.env.ADMIN_PASSWORD) {
      console.log(
        "Generated admin password (save it now — it is not stored and will not be shown again):",
        adminPassword
      );
    }
  } else {
    await User.findOneAndUpdate(
      { email: ADMIN_EMAIL },
      { $set: { name: "Admin", role: "admin" } },
      { upsert: true, new: true }
    );
    console.log("Admin already exists — keeping existing password (set ADMIN_PASSWORD or ADMIN_RESET_PASSWORD=1 to rotate).");
  }

  const admin = await User.findOne({ email: ADMIN_EMAIL });
  console.log("Admin ready:", { id: admin._id, email: admin.email, role: admin.role });

  const count = await User.countDocuments({ role: "admin" });
  console.log("Total admin users in DB:", count);

  await mongoose.disconnect();
})().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});