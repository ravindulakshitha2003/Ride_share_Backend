import "dotenv/config"; //loads environment variables
import express from "express";
import cors from "cors";
import mongoose from "mongoose";

import authRoute from "./routes/authRoute.js";
import vehicleRoutes from "./routes/vehicleRoute.js";
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

//vehicle route
app.use("/api/vehicles", vehicleRoutes);

// Central error handler
app.use((err, req, res, next) => {
  console.error(err.message);

  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      message: "Invalid JSON body",
    });
  }

  if (err.name === "ValidationError" || err.name === "CastError") {
    return res.status(400).json({
      message: "Invalid input",
    });
  }

  return res.status(500).json({
    message: "Internal server error",
  });
});

// Connect to MongoDB and start the service
const PORT = process.env.PORT || 4001;

async function startServer() {
  try {
    if (!process.env.MONGO_URI) {  //reads the MongoDB connection string from  .env file.
      throw new Error("MONGO_URI is missing from .env");
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is missing from .env");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    app.listen(PORT, () => {
      console.log(`Identity service running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Identity service startup failed:", error.message);
    process.exit(1);
  }
}

startServer();