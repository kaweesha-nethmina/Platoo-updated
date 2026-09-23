import { Request, Response } from "express";
import User, { UserRole } from "../models/User";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AuthRequest } from "../middleware/authMiddleware";  // Ensure this is correct
import mongoose from "mongoose";
import { OAuth2Client } from "google-auth-library";

const generateToken = (id: string, role: string): string => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET!, { expiresIn: "1d" });
};

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Roles an unauthenticated person may self-assign at registration. Elevated
// roles (admin) can only be provisioned through the admin-only flows
// (e.g. seed-admin.js) — never via public registration.
const PUBLIC_REGISTRATION_ROLES = [
  UserRole.USER,
  UserRole.RESTAURANT_OWNER,
  UserRole.DELIVERY_MAN,
];

// Mirrors the client-side registration policy (see register/page.tsx).
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;
const PASSWORD_REQUIREMENTS = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).+$/;

const isValidPassword = (value: string): boolean =>
  value.length >= PASSWORD_MIN &&
  value.length <= PASSWORD_MAX &&
  PASSWORD_REQUIREMENTS.test(value);

// Returns a user document ready for JSON responses: never include the password
// hash or internal auth identifiers (V-06 / V-11).
const toSafeUser = (user: {
  toObject: () => Record<string, unknown>;
}): Record<string, unknown> => {
  const { password: _pw, googleId: _googleId, ...safe } = user.toObject();
  return safe;
};

// Register user
export const register = async (req: Request, res: Response): Promise<void> => {
  const { name, email, password, role, phone, address, restaurantName, vehicleNumber } = req.body;

  if (!email || typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    res.status(400).json({ msg: "Invalid email address" });
    return;
  }
  if (typeof password !== "string" || !isValidPassword(password)) {
    res.status(400).json({
      msg: "Password must be 8-128 characters with uppercase, lowercase, a number, and a special character",
    });
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  // Server-side guard (V-02): ignore any privileged/unknown role sent by the
  // client. Customer, restaurant owner, and delivery person may pick their own
  // role; anything else (e.g. "admin") is downgraded to the default "user".
  const safeRole = PUBLIC_REGISTRATION_ROLES.includes(role)
    ? role
    : UserRole.USER;

  const user = new User({
    name,
    email,
    password: hashedPassword,
    role: safeRole,
    phone,
    address,
    restaurantName,
    vehicleNumber,
  });

  try {
    console.log("Registering user:", email, "role:", safeRole); // Never log credentials
    await user.save();
    res.status(201).json({ msg: "User registered" });
  } catch (error: unknown) {
    console.error("Registration error:", error); // Log error
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: number }).code === 11000
    ) {
      res.status(409).json({ msg: "An account with this email already exists" });
      return;
    }
    res.status(500).json({ msg: "Unable to register user" });
  }
};

// Login user
export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user || !user.password || !(await bcrypt.compare(password, user.password))) {
      res.status(401).json({ msg: "Invalid credentials" });
      return; // Ensure to exit early after sending the response
    }

    const token = generateToken(user.id, user.role);
    res.json({ token });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ msg: "Unable to sign in" });
  }
};

// Google OAuth (OIDC) sign-in
export const googleAuth = async (req: Request, res: Response): Promise<void> => {
  const { idToken } = req.body;

  if (!idToken || typeof idToken !== "string") {
    res.status(400).json({ msg: "Missing ID token" });
    return;
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload || !payload.email || !payload.sub) {
      res.status(401).json({ msg: "Invalid Google token" });
      return;
    }

    const { email, sub: googleId, name } = payload;

    let user = await User.findOne({ email });

    if (!user) {
      user = new User({
        name: name || email.split("@")[0],
        email,
        googleId,
        authProvider: "google",
        role: UserRole.USER,
      });
      await user.save();
    } else if (user.authProvider === "local") {
      user.googleId = googleId;
      await user.save();
    }

    const token = generateToken(user.id, user.role);
    res.json({ token });
  } catch (error) {
    console.error("Google auth error:", error);
    res.status(401).json({ msg: "Invalid Google token" });
  }
};

// Update user - Admin can update any profile, others can only update their own
export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, email, phone, address, restaurantName, vehicleNumber, newPassword, location } = req.body;
  const userId = req.params.userId; // Get userId from the URL parameter
  const currentUser = req.user; // This comes from the middleware (protect)
  if (!currentUser) {
    res.status(401).json({ msg: "Unauthorized: No user found" });
    return;
  }
  // Admin can update any profile
  // Non-admins (users and delivery men) can only update their own profile (userId should match the logged-in user)
  if (currentUser.role !== UserRole.ADMIN && currentUser.id !== userId) {
    res.status(403).json({ msg: "Forbidden: You can only update your own profile" });
    return;
  }
  try {
    // Check if the userId is valid
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).json({ msg: "Invalid userId format" });
      return;
    }
    // Find the user by ObjectId
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ msg: "User not found" });
      return;
    }
    // Update only the fields that are provided in the request body
    if (name) user.name = name;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (address) user.address = address;
    if (restaurantName) user.restaurantName = restaurantName;
    if (vehicleNumber) user.vehicleNumber = vehicleNumber;
    if (location) user.location = location; // Update the location field
    // If the new password is provided, hash it and update it (and enforce the
    // same strength policy used at registration).
    if (newPassword) {
      if (typeof newPassword !== "string" || !isValidPassword(newPassword)) {
        res.status(400).json({
          msg: "Password must be 8-128 characters with uppercase, lowercase, a number, and a special character",
        });
        return;
      }
      const hashedPassword = await bcrypt.hash(newPassword, 10); // Hash the new password
      user.password = hashedPassword; // Update the password in the user document
    }
    // Save the updated user information
    await user.save();
    res.status(200).json({ msg: "User updated successfully", user: toSafeUser(user) });
  } catch (error: unknown) {
    console.error("Error updating user:", error);
    res.status(500).json({ msg: "Unable to update user" });
  }
};



// Delete user - Admin can delete any user, others can delete themselves
export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
    const { userId } = req.params;
    const currentUser = req.user;
  
    // Check if currentUser is defined and if they have the correct permissions to delete
    if (!currentUser) {
        res.status(401).json({ msg: "Unauthorized: No user found" });
        return ;
    }
  
    if (currentUser.role !== UserRole.ADMIN && currentUser.id !== userId) {
      res.status(403).json({ msg: "Forbidden: You can only delete your own profile" });
        return ;
    }
  
    try {
      // Find the user by ID to delete
      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json({ msg: "User not found" });
        return ;
      }
  
// Delete the user using deleteOne()
      await user.deleteOne(); // Use `deleteOne()` instead of `remove()` in Mongoose v6

      // Send response confirming deletion
      res.status(200).json({ msg: "User deleted successfully" });
    } catch (error: unknown) {
      console.error("Error deleting user:", error);
      res.status(500).json({ msg: "Unable to delete user" });
    }
  };
  
// Get all users (Admin / restaurant-owner only, never exposes password hashes)
export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await User.find().select("-password"); // Fetch all users without password hashes
    res.status(200).json(users); // Return the list of users
  } catch (error: unknown) {
    console.error("Error fetching users:", error);
    res.status(500).json({ msg: "Unable to fetch users" });
  }
};


export const getUserById = async (req: Request, res: Response): Promise<void> => {
  const userId = req.params.userId; // Get userId from the route parameter

  try {
    // Check if the userId is valid
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).json({ msg: "Invalid userId format" });
      return;
    }

    // Find the user by ObjectId (never expose the password hash)
    const user = await User.findById(userId).select("-password");
    if (!user) {
      res.status(404).json({ msg: "User not found" });
      return;
    }

    // Return the user data
    res.status(200).json(user);
  } catch (error: unknown) {
    console.error("Error fetching user:", error);
    res.status(500).json({ msg: "Unable to fetch user" });
  }
};



// controllers/authController.ts
// Public helper used by restaurant profile pages; returns only safe, non-secret fields.
export const getRestaurantOwnerByIdPublic = async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.params;

  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      res.status(400).json({ msg: "Invalid userId format" });
      return;
    }

    const user = await User.findOne({ _id: userId, role: UserRole.RESTAURANT_OWNER }).select(
      "-password -googleId -updatedAt"
    );

    if (!user) {
      res.status(404).json({ msg: "Restaurant owner not found" });
      return;
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching restaurant owner:", error);
    res.status(500).json({ msg: "Unable to fetch restaurant owner" });
  }
};



