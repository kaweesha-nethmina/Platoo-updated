import { Router, Response } from "express";
import { AuthRequest } from "../middleware/authMiddleware"; // Import AuthRequest
import { UserRole } from "../models/User"; // Ensure UserRole is correctly imported
import { register, login, updateUser, deleteUser, getAllUsers, getUserById, getRestaurantOwnerByIdPublic, getCurrentUser, googleAuth, logout } from "../controllers/authController";
import { protect } from "../middleware/authMiddleware";
import { rejectNoSqlOperators } from "../middleware/noSqlAntiInjection";

const router = Router();

// (V-03 hygiene) Screen route params / query / body for MongoDB operator
// injection (`$`-keys, dot-notation keys, `$`-prefixed values) up front.
router.use(rejectNoSqlOperators);

// Register route
router.post("/register", async (req: AuthRequest, res: Response) => {
  await register(req, res); // Call the register function directly
});

// Login route
router.post("/login", async (req: AuthRequest, res: Response) => {
  await login(req, res); // Call the login function directly
});

// Google OAuth (OIDC) sign-in route
router.post("/google", async (req: AuthRequest, res: Response) => {
  await googleAuth(req, res); // Call the googleAuth function directly
});

// V-14: server-side logout — revokes the presented JWT so it can no longer
// call user-service routes, even if the cookie/header is later replayed.
router.post(
  "/logout",
  protect([UserRole.ADMIN, UserRole.RESTAURANT_OWNER, UserRole.USER, UserRole.DELIVERY_MAN]),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      await logout(req, res);
    } catch (error) {
      res.status(500).json({ msg: "Error during logout" });
    }
  }
);

// V-08: current session (used by the httpOnly-cookie BFF). Requires auth like
// every protected route; anyone with a valid token may query their own profile.
router.get(
  "/me",
  protect([UserRole.ADMIN, UserRole.RESTAURANT_OWNER, UserRole.USER, UserRole.DELIVERY_MAN]),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      await getCurrentUser(req, res);
    } catch (error) {
      res.status(500).json({ msg: "Internal server error" });
    }
  }
);

// V-14: token introspection for sibling services (e.g. order-service). Lets
// them confirm a JWT is still valid — and not revoked — against the identity
// plane before honoring it, without sharing the blacklist collection.
router.get(
  "/verify",
  protect([UserRole.ADMIN, UserRole.RESTAURANT_OWNER, UserRole.USER, UserRole.DELIVERY_MAN]),
  async (req: AuthRequest, res: Response): Promise<void> => {
    res.status(200).json({ valid: true, user: { id: req.user?.id, role: req.user?.role } });
  }
);

// Update user route
router.put(
  "/update/:userId",
  protect([UserRole.ADMIN, UserRole.RESTAURANT_OWNER, UserRole.USER, UserRole.DELIVERY_MAN]),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      await updateUser(req, res); // Call the updateUser function directly
    } catch (error) {
      res.status(500).json({ message: "Error during update" });
    }
  }
);

// Delete user route
router.delete(
  "/delete/:userId",
  protect([UserRole.ADMIN, UserRole.RESTAURANT_OWNER, UserRole.USER, UserRole.DELIVERY_MAN]),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      await deleteUser(req, res); // Call the deleteUser function directly
    } catch (error) {
      res.status(500).json({ message: "Error during delete" });
    }
  }
);

// Get all users - restricted to admin / restaurant-owner (V-06)
router.get(
  "/users",
  protect([UserRole.ADMIN, UserRole.RESTAURANT_OWNER]),
  async (req: AuthRequest, res: Response) => {
    await getAllUsers(req, res);
  }
);

// Get user by ID - authenticated only (V-06); password hash never returned
router.get(
  "/user/:userId",
  protect([UserRole.ADMIN, UserRole.RESTAURANT_OWNER, UserRole.USER, UserRole.DELIVERY_MAN]),
  async (req: AuthRequest, res: Response) => {
    await getUserById(req, res);
  }
);

router.get("/restaurant-owner/:userId", getRestaurantOwnerByIdPublic);




export default router;