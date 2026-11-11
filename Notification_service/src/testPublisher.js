import "dotenv/config";
import amqp from "amqplib";

const exchange =
  process.env.RABBITMQ_EXCHANGE || "rideshare.events";

async function sendTestEvent() {
  const connection = await amqp.connect(process.env.RABBITMQ_URL);
  const channel = await connection.createConfirmChannel();

  await channel.assertExchange(exchange, "topic", {
    durable: true,
  });

  const event = {
    eventId: `test-${Date.now()}`,
    eventType: "booking.requested",
    recipientUserId: "test-driver-123",
    title: "Test booking notification",
    body: "RabbitMQ message reached the notification service.",
    data: {
      bookingId: "test-booking-1",
      rideId: "test-ride-1",
    },
  };

  channel.publish(
    exchange,
    "notifications.booking.requested",
    Buffer.from(JSON.stringify(event)),
    {
      persistent: true,
      contentType: "application/json",
    }
  );

  await channel.waitForConfirms();
  console.log("Test event sent:", event.eventId);

  await channel.close();
  await connection.close();
}

sendTestEvent().catch((error) => {
  console.error("Could not send test event:", error.message);
  process.exitCode = 1;
});