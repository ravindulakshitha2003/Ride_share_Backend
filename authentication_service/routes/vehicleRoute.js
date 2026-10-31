
import express from "express";

import {
  registerVehicle,
  getMyVehicles,
  updateMyVehicle,
  deleteMyVehicle,
} from "../controllers/vehicleController.js";

import {
  verifyToken,
  allowRoles,
} from "../middleware/authMiddleware.js";

import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

// All vehicle management endpoints require an authenticated driver.
router.use(verifyToken, allowRoles("driver"));

// Add another vehicle to the logged-in driver's profile.
router.post(
  "/",
  upload.single("vehiclePhoto"),
  registerVehicle
);

// Get all vehicles belonging to the logged-in driver.
router.get("/me", getMyVehicles);

//update vehicle
router.put(
  "/:id",
  upload.single("vehiclePhoto"),
  updateMyVehicle
);

// Delete a vehicle belonging to the logged-in driver.
router.delete("/:id", deleteMyVehicle);

export default router;
