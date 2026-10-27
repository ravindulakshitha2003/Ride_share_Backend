
import express from "express";
import {
  registerVehicle,
  getMyVehicles,
  deleteMyVehicle,
} from "../controllers/vehicleController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(verifyToken);

router.post("/", registerVehicle);
router.get("/my", getMyVehicles);
router.delete("/:id", deleteMyVehicle);

export default router;
