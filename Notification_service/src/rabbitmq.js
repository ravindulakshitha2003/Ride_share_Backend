
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


async function handleBookingEvent(event) {
  const { eventId, eventType, data } = event;

  let userId;
  let title;
  let body;

  switch (eventType) {
    case "booking.requested":
      userId = data.driverId;
      title = "New Booking Request";
      body = `A passenger requested ${data.requestedSeats} seat(s) from ${data.passengerOrigin} to ${data.passengerDestination}.`;
      break;

    case "booking.confirmed":
      userId = data.passengerId;
      title = "Booking Confirmed";
      body = "Your booking has been confirmed.";
      break;

    case "booking.rejected":
      userId = data.passengerId;
      title = "Booking Rejected";
      body = data.reason
        ? `Your booking was rejected. Reason: ${data.reason}`
        : "Your booking was rejected.";
      break;

    case "booking.cancelled":
      userId =
        data.cancelledBy === "PASSENGER"
          ? data.driverId
          : data.cancelledBy === "DRIVER"
            ? data.passengerId
            : null;

      if (!userId) {
        throw new Error("Invalid cancelledBy value");
      }

      title = "Booking Cancelled";
      body = data.reason
        ? `Booking cancelled. Reason: ${data.reason}`
        : "A booking was cancelled.";
      break;

    default:
      return false;
  }

  if (!userId) {
    throw new Error("Booking notification recipient is missing");
  }

  await createNotification({
    eventId,
    userId: String(userId),
    type: eventType,
    title,
    body,
    data: data || {}
  });

  return true;
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

  // Listen to events from both Ride and Booking services.
  for (const pattern of routingPatterns) {
    await channel.bindQueue(queue, exchange, pattern);
  }

  channel.prefetch(10);

  await channel.consume(
    queue,
    async (message) => {
      if (!message) return;

      let event;

      // Parse and validate the incoming event.
      try {
        event = JSON.parse(message.content.toString("utf8"));

        if (!isValidEvent(event)) {
          console.error("Invalid notification event:", event);
          channel.nack(message, false, false);
          return;
        }
      } catch (error) {
        console.error("Invalid event JSON:", error.message);
        channel.nack(message, false, false);
        return;
      }

      // Save the notification through the service layer.
      try {
        if (message.fields.routingKey.startsWith("booking.")) {
            await handleBookingEvent(event);
          } else {
          await createNotification({
            eventId: event.eventId,
            userId: event.recipientUserId,
            type: event.eventType,
            title: event.title,
            body: event.body,
            data: event.data || {},
          });
        }
        console.log(
          "Notification saved:",
          event.eventId,
          "Routing key:",
          message.fields.routingKey
        );

        channel.ack(message);
      } catch (error) {
        console.error(
          "Could not save notification:",
          error.message
        );

        // Temporary retry behaviour. A dead-letter/retry
        // queue should be configured before production use.
        channel.nack(message, false, true);
      }
    },
    { noAck: false }
  );

  console.log(
    `Listening on exchange "${exchange}"`,
    `with routing patterns: ${routingPatterns.join(", ")}`
  );

  connection.on("error", (error) => {
    console.error("RabbitMQ connection error:", error.message);
  });

  channel.on("error", (error) => {
    console.error("RabbitMQ channel error:", error.message);
  });
}
