
import express from "express";

import {
  createDriverProfile,
  getMyDriverProfile,
  updateMyDriverProfile,
} from "../controllers/driverController.js";

import {
  verifyToken,
  allowRoles,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(verifyToken);
router.use(allowRoles("driver"));

router.post("/", createDriverProfile);
router.get("/me", getMyDriverProfile);
router.patch("/me", updateMyDriverProfile);

export default router;
