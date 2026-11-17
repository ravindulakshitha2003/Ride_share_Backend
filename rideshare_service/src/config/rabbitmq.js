
import amqp from "amqplib";

const EXCHANGE =
  process.env.RABBITMQ_EXCHANGE || "rideshare.events";

let connection;
let channel;

export async function connectRabbitMQ() {
  if (channel) return;

  if (!process.env.RABBITMQ_URL) {
    throw new Error("RABBITMQ_URL is missing from .env");
  }

  connection = await amqp.connect(process.env.RABBITMQ_URL);

  channel = await connection.createConfirmChannel();

  await channel.assertExchange(EXCHANGE, "topic", {
    durable: true,
  });

  connection.on("error", (error) => {
    console.error("RabbitMQ connection error:", error.message);
  });

  connection.on("close", () => {
    console.error("RabbitMQ connection closed");
    connection = null;
    channel = null;
  });

  console.log("RabbitMQ publisher connected");
}

export async function publishEvent(routingKey, event) {
  if (!channel) {
    throw new Error("RabbitMQ publisher is not connected");
  }

  const message = Buffer.from(JSON.stringify(event));

  channel.publish(EXCHANGE, routingKey, message, {
    persistent: true,
    contentType: "application/json",
    messageId: event.eventId,
    timestamp: Date.now(),
  });

  await channel.waitForConfirms();

  console.log("RabbitMQ event published:", routingKey);
}
