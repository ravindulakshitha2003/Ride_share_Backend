import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import multer from "multer";

import authRoute from "./routes/authRoute.js";
import vehicleRoutes from "./routes/vehicleRoute.js";
import driverRoutes from "./routes/driverRoute.js";
import { getMe } from "./controllers/authController.js";
import { verifyToken } from "./middleware/authMiddleware.js";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "identity-service",
    uptime: process.uptime(),
  });
});

// Authentication routes
app.use("/api/auth", authRoute);

// Authenticated user profile
app.get("/me", verifyToken, getMe);

// Vehicle routes
app.use("/api/vehicles", vehicleRoutes);

//driver routes
app.use("/api/drivers", driverRoutes);

// Central error handler
app.use((err, req, res, next) => {

    console.error("ERROR NAME:", err.name);
  console.error("ERROR MESSAGE:", err.message);
  console.error("ERROR DETAILS:", err);

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message: "Profile photo must be 5 MB or smaller",
      });
    }

    return res.status(400).json({
      message: "Invalid photo upload",
    });
  }

  if (
    err.message ===
    "Only JPEG, PNG, and WebP images are allowed"
  ) {
    return res.status(400).json({
      message: err.message,
    });
  }

  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      message: "Invalid JSON body",
    });
  }

  if (
    err.name === "ValidationError" ||
    err.name === "CastError"
  ) {
    return res.status(400).json({
      message: "Invalid input",
    });
  }

  console.error(err);

  return res.status(500).json({
    message: "Internal server error",
  });
});

// Connect to MongoDB and start service
const PORT = process.env.PORT || 4001;

async function startServer() {
  try {
    const requiredEnv = [
      "MONGO_URI",
      "JWT_SECRET",
      "CLOUDINARY_CLOUD_NAME",
      "CLOUDINARY_API_KEY",
      "CLOUDINARY_API_SECRET",
    ];

    for (const key of requiredEnv) {
      if (!process.env[key]) {
        throw new Error(`${key} is missing from .env`);
      }
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    app.listen(PORT, () => {
      console.log(`Identity service running on port ${PORT}`);
    });
  } catch (error) {
    console.error(
      "Identity service startup failed:",
      error.message
    );
    process.exit(1);
  }
}

startServer();