import "dotenv/config";
import express from "express";
import cors from "cors";
import { startEventConsumer } from "./rabbitmq.js";
import mongoose from "mongoose";
import notificationRoutes from "./notificationRoutes.js";

const app = express();
const port = Number(process.env.PORT || 4003);

app.use(cors());
app.use(express.json());

app.use("/api/notifications", notificationRoutes);

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "notification-service",
  });
});

async function start() {
    if (!process.env.RABBITMQ_URL) {
    throw new Error("RABBITMQ_URL is missing from .env");
    }

    if(!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing from .env");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

  // RabbitMQ consumer-ஐ முதலில் connect செய்கிறது.
  await startEventConsumer();

  app.listen(port, "0.0.0.0", () => {
    console.log(`Notification service listening on port ${port}`);
  });
}

start().catch((error) => {
  console.error("Notification service failed to start:", error.message);
  process.exit(1);
});