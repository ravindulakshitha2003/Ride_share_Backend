
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


// ==========================================
// 1. BASIC CONFIGURATION
// ==========================================

const PORT = process.env.PORT || 4001;

// Trust the local Nginx reverse proxy.
// Appropriate for this local single-proxy setup.
app.set("trust proxy", "loopback");


// ==========================================
// 2. MIDDLEWARE
// ==========================================

app.use(cors());

app.use(express.json());


// ==========================================
// 3. HEALTH CHECK
// ==========================================

app.get("/health", (req, res) => {

  res.status(200).json({
    status: "ok",
    service: "identity-service",
    uptime: process.uptime(),
  });

});


// ==========================================
// 4. AUTHENTICATION ROUTES
// ==========================================

app.use("/api/auth", authRoute);


// ==========================================
// 5. USER PROFILE
// ==========================================

app.get("/me", verifyToken, getMe);


// ==========================================
// 6. VEHICLE ROUTES
// ==========================================

app.use("/api/vehicles", vehicleRoutes);


// ==========================================
// 7. DRIVER ROUTES
// ==========================================

app.use("/api/drivers", driverRoutes);


// ==========================================
// 8. CENTRAL ERROR HANDLER
// ==========================================

app.use((err, req, res, next) => {

  // Multer file upload errors
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


  // Invalid image format
  if (
    err.message ===
    "Only JPEG, PNG, and WebP images are allowed"
  ) {

    return res.status(400).json({
      message: err.message,
    });

  }


  // Invalid JSON
  if (err.type === "entity.parse.failed") {

    return res.status(400).json({
      message: "Invalid JSON body",
    });

  }


  // Database validation errors
  if (
    err.name === "ValidationError" ||
    err.name === "CastError"
  ) {

    return res.status(400).json({
      message: "Invalid input",
    });

  }


  // Unexpected errors
  console.error("Identity Service Error:", err);

  return res.status(500).json({
    message: "Internal server error",
  });

});


// ==========================================
// 9. REQUIRED ENVIRONMENT VARIABLES
// ==========================================

const requiredEnv = [
  "MONGO_URI",
  "JWT_SECRET",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];


// ==========================================
// 10. START SERVER
// ==========================================

async function startServer() {

  try {

    // Check environment variables
    for (const key of requiredEnv) {

      if (!process.env[key]) {

        throw new Error(`${key} is missing from .env`);

      }

    }


    // Connect MongoDB
    await mongoose.connect(process.env.MONGO_URI);

    console.log("Connected to MongoDB");


    // Start Express server
  const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Identity service running on port ${PORT}`);
});


    // ======================================
    // 11. GRACEFUL SHUTDOWN
    // ======================================

    async function shutdown(signal) {

      console.log(`${signal} received. Shutting down...`);

      server.close(async () => {

        try {

          await mongoose.disconnect();

          console.log("MongoDB disconnected");

          process.exit(0);

        } catch (error) {

          console.error("Shutdown error:", error);

          process.exit(1);

        }

      });

    }


    process.on("SIGTERM", () => shutdown("SIGTERM"));

    process.on("SIGINT", () => shutdown("SIGINT"));


  } catch (error) {

    console.error(
      "Identity service startup failed:",
      error.message
    );

    await mongoose.disconnect().catch(() => {});

    process.exit(1);

  }

}


// Start the application
startServer();
