
import crypto from 'node:crypto';
import { getChannel } from '../config/rabbitmq.js';

export async function sendMessage(eventType, routingKey, data) {
  const channel = getChannel();

  const message = {
    eventId: crypto.randomUUID(),
    eventType,
    source: 'RIDE_SERVICE',
    data,
    createdAt: new Date().toISOString()
  };

  channel.publish(
    'ride_exchange',
    routingKey,
    Buffer.from(JSON.stringify(message)),
    {
      persistent: true,
      contentType: 'application/json',
      messageId: message.eventId
    }
  );

  // Wait for RabbitMQ publisher confirmation.
  await channel.waitForConfirms();

  console.log(`Event published: ${eventType}`);

  return message;
}
