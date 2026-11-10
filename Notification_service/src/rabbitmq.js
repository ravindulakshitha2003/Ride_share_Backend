import amqp from "amqplib";

const exchange =
  process.env.RABBITMQ_EXCHANGE || "rideshare.events";

const queue =
  process.env.RABBITMQ_QUEUE || "notification.events";

// எல்லா notification event-களும் notifications.* என்ற routing key-ஐப் பயன்படுத்தும்.
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

  // ஒரே நேரத்தில் process செய்யும் message எண்ணிக்கையை கட்டுப்படுத்துகிறது.
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

          // தவறான message-ஐ மீண்டும் மீண்டும் queue-க்கு அனுப்பாமல் நிராகரிக்கிறது.
          channel.nack(message, false, false);
          return;
        }

        console.log("Notification event received:", {
          eventId: event.eventId,
          eventType: event.eventType,
          recipientUserId: event.recipientUserId,
          title: event.title,
          body: event.body,
          data: event.data || {},
        });

        // அடுத்த கட்டத்தில் இங்கே MongoDB-ல் notification சேமித்து
        // mobile push notification அனுப்புவோம்.
        channel.ack(message);
      } catch (error) {
        console.error("Could not process event:", error.message);
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