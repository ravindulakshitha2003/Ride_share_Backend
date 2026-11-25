
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




router.post("/",verifyToken, createDriverProfile);
router.get("/me",verifyToken, getMyDriverProfile);
router.put("/me",verifyToken,updateMyDriverProfile);
router.delete("/convert-to-passenger",verifyToken, convertDriverToPassenger);
router.post("/getDriver&Vehical",getdriverVehicles)

export default router;
