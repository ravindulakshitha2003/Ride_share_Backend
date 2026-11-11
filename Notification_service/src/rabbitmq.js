import amqp from "amqplib";
import Notification from "./models/Notification.js";

const exchange =
  process.env.RABBITMQ_EXCHANGE || "rideshare.events";

const queue =
  process.env.RABBITMQ_QUEUE || "notification.events";

const routingPattern = "notifications.#";

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
  const connection = await amqp.connect(process.env.RABBITMQ_URL);
  const channel = await connection.createChannel();

  await channel.assertExchange(exchange, "topic", {
    durable: true,
  });

  await channel.assertQueue(queue, {
    durable: true,
  });

  await channel.bindQueue(queue, exchange, routingPattern);
  channel.prefetch(10);

  await channel.consume(
    queue,
    async (message) => {
      if (!message) return;

      try {
        const event = JSON.parse(
          message.content.toString("utf8")
        );

        if (!isValidEvent(event)) {
          console.error("Invalid notification event:", event);
          channel.nack(message, false, false);
          return;
        }

        await Notification.findOneAndUpdate(
          {
            eventId: event.eventId,
            userId: event.recipientUserId,
          },
          {
            $setOnInsert: {
              eventId: event.eventId,
              userId: event.recipientUserId,
              type: event.eventType,
              title: event.title,
              body: event.body,
              data: event.data || {},
            },
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          }
        );

        console.log(
          "Notification saved to MongoDB:",
          event.eventId
        );

        channel.ack(message);
      } catch (error) {
        console.error(
          "Could not process notification:",
          error.message
        );

        channel.nack(message, false, false);
      }
    },
    { noAck: false }
  );

  console.log(
    `Listening to "${routingPattern}" on queue "${queue}"`
  );

  connection.on("error", (error) => {
    console.error("RabbitMQ connection error:", error.message);
  });
}