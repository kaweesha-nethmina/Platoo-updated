import express from "express";
import { DeliveryController } from "../controllers/deliveryController";
import { authMiddleware } from "../middleware/auth";

const router = express.Router();

// // Create a new delivery
// router.post("/", DeliveryController.createDelivery);

// // Get all deliveries (assigned + unassigned)
// router.get("/", DeliveryController.getAllDeliveries);

// // Get all unassigned deliveries (for delivery men to pick)
// router.get("/unassigned", DeliveryController.getUnassignedDeliveries);

// // Get delivery by ID
// router.get("/:id", DeliveryController.getDeliveryById);

// // Assign delivery to a delivery man
// router.put("/:id/assign", DeliveryController.assignDeliveryToMan);

// // Update delivery status
// router.put("/:id/status", DeliveryController.updateDeliveryStatus);

// // Delete delivery
// router.delete("/:id", DeliveryController.deleteDelivery);

// router.get("/count/:deliveryManId", DeliveryController.getDeliveryCount);



// Existing routes...





// Main CRUD
router.post("/", authMiddleware, DeliveryController.createDelivery);
router.get("/", authMiddleware, DeliveryController.getAllDeliveries);
router.get("/unassigned", authMiddleware, DeliveryController.getUnassignedDeliveries);
router.get("/assigned/:driverId", authMiddleware, DeliveryController.getAssignedDelivery);
router.delete("/:id", authMiddleware, DeliveryController.deleteDelivery);

// New API for Driver
router.get("/driver/:driverId", authMiddleware, DeliveryController.getDeliveriesByDriver);
router.get("/driver/:driverId/completed", authMiddleware, DeliveryController.getCompletedDeliveriesByDriver);

export default router;

