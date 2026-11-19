
import express from "express";


import {
  createDriverProfile,
  convertDriverToPassenger,
  getMyDriverProfile,
  updateMyDriverProfile,
} from "../controllers/driverController.js";

import {
  verifyToken,
  allowRoles,
} from "../middleware/authMiddleware.js";
import { getdriverVehicles } from "../controllers/vehicleController.js";

const router = express.Router();

router.use(verifyToken);
router.use(allowRoles("driver"));

router.post("/", createDriverProfile);
router.get("/me", getMyDriverProfile);
router.put("/me",updateMyDriverProfile);
router.delete("/convert-to-passenger", convertDriverToPassenger);
router.post("/getDriver&Vehical",getdriverVehicles)

export default router;
