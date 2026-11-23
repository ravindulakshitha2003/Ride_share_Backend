import amqp from "amqplib";
import { createNotification } from "./services/notificationService.js";

const exchange =
  process.env.RABBITMQ_EXCHANGE || "rideshare.events";

const queue =
  process.env.RABBITMQ_QUEUE || "notification.events";

const routingPatterns = ["ride.*", "booking.*"];

function isValidEvent(event) {
  return (
    event &&
    typeof event.eventId === "string" &&
    typeof event.eventType === "string" &&
    typeof event.recipientUserId === "string" &&
    typeof event.title === "string" &&
    typeof event.body === "string"
  );
}

export async function startEventConsumer() {
  const connection = await amqp.connect(
    process.env.RABBITMQ_URL
  );

  const channel = await connection.createChannel();

  await channel.assertExchange(exchange, "topic", {
    durable: true,
  });

  await channel.assertQueue(queue, {
    durable: true,
  });

  // Listen to events from both Ride and Booking services.
  for (const pattern of routingPatterns) {
    await channel.bindQueue(queue, exchange, pattern);
  }

  channel.prefetch(10);

  await channel.consume(
    queue,
    async (message) => {
      if (!message) return;

      // Print every received message immediately.
      console.log("\n====================================");
      console.log("📩 MESSAGE RECEIVED FROM RABBITMQ");
      console.log("====================================");

      console.log(
        "Routing Key:",
        message.fields.routingKey
      );

      console.log(
        "Raw Message:",
        message.content.toString("utf8")
      );

      let event;

      // Parse and validate the incoming event.
      try {
        event = JSON.parse(
          message.content.toString("utf8")
        );

        console.log("Parsed Event:", event);

        if (!isValidEvent(event)) {
          console.error(
            "❌ Invalid notification event:",
            event
          );

          channel.nack(message, false, false);
          return;
        }
      } catch (error) {
        console.error(
          "❌ Invalid event JSON:",
          error.message
        );

        channel.nack(message, false, false);
        return;
      }

      // Save the notification through the service layer.
      try {
        await createNotification({
          eventId: event.eventId,
          userId: event.recipientUserId,
          type: event.eventType,
          title: event.title,
          body: event.body,
          data: event.data || {},
        });

        console.log(
          "✅ Notification saved:",
          event.eventId
        );

        console.log(
          "Routing Key:",
          message.fields.routingKey
        );

        // Acknowledge the message after successful processing.
        channel.ack(message);

        console.log("✅ Message acknowledged");
        console.log("====================================\n");
      } catch (error) {
        console.error(
          "❌ Could not save notification:",
          error.message
        );

        // Requeue the message for retry.
        channel.nack(message, false, true);

        console.log("🔄 Message requeued");
        console.log("====================================\n");
      }
    },
    {
      noAck: false,
    }
  );

  console.log(
    `🚀 Notification Service listening on exchange "${exchange}"`
  );

  console.log(
    `📌 Routing patterns: ${routingPatterns.join(", ")}`
  );

  console.log(
    `📦 Queue: ${queue}`
  );

  connection.on("error", (error) => {
    console.error(
      "RabbitMQ connection error:",
      error.message
    );
  });

  connection.on("close", () => {
    console.error(
      "RabbitMQ connection closed"
    );
  });

  channel.on("error", (error) => {
    console.error(
      "RabbitMQ channel error:",
      error.message
    );
  });
}