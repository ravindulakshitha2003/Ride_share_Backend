
import "dotenv/config";
import app from "./app.js";
import { connectRabbitMQ } from "./config/rabbitmq.js";

const PORT = Number(process.env.PORT || 5000);

async function startServer() {
  try {
    // Connect to RabbitMQ first
    await connectRabbitMQ();

    // Start Express server
    app.listen(PORT, "0.0.0.0", () => {
      console.log(
        `Share-Ride API listening on port ${PORT}`
      );
    });
  } catch (error) {
    console.error(
      "Failed to start Ride Publishing Service:",
      error.message
    );

    process.exit(1);
  }
}

startServer();
