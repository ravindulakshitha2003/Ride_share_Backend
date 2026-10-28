
import express from "express";

import {
  register,
  login,
} from "../controllers/authController.js";

import {
  registerDriverWithVehicle,
} from "../controllers/combinedRegistrationController.js";

import upload from "../middleware/uploadMiddleware.js";
import registrationUpload from "../middleware/registrationUpload.js";

const router = express.Router();

// Passenger registration
router.post(
  "/register",
  upload.single("profilePhoto"),
  register
);

// Login for passengers and drivers
router.post("/login", login);

// Driver registration: account + driver details + vehicle details
router.post(
  "/register-driver",
  registrationUpload.fields([
    { name: "profilePhoto", maxCount: 1 },
    { name: "vehiclePhoto", maxCount: 1 },
  ]),
  registerDriverWithVehicle
);

export default router;
