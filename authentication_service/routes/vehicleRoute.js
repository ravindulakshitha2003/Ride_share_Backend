
import express from "express";
import {
  registerVehicle,
  getMyVehicles,
  deleteMyVehicle,
} from "../controllers/vehicleController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.use(verifyToken);


router.post(
  "/",
  upload.single("vehiclePhoto"),
  registerVehicle
);
router.get("/my", getMyVehicles);
router.delete("/:id", deleteMyVehicle);


export default router;
