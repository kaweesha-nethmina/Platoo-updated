import express from "express";
import { DeliveryController } from "../controllers/deliveryController";

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
router.post("/", DeliveryController.createDelivery);
router.get("/", DeliveryController.getAllDeliveries);
router.get("/unassigned", DeliveryController.getUnassignedDeliveries);
router.get("/assigned/:driverId", DeliveryController.getAssignedDelivery);
router.delete("/:id", DeliveryController.deleteDelivery);

// New API for Driver
router.get("/driver/:driverId", DeliveryController.getDeliveriesByDriver);
router.get("/driver/:driverId/completed", DeliveryController.getCompletedDeliveriesByDriver);

export default router;

