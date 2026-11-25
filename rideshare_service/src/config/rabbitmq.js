import amqp from 'amqplib';

let connection;
let channel;

const EXCHANGE = process.env.RABBITMQ_EXCHANGE || 'rideshare.events';

export async function connectRabbitMQ() {
  connection = await amqp.connect(
    process.env.RABBITMQ_URL
  );

  channel = await connection.createConfirmChannel();

  await channel.assertExchange(
    EXCHANGE,
    'topic',
    { durable: true }
  );

  console.log(`Connected to RabbitMQ (Exchange: ${EXCHANGE})`);

  return channel;
}

export function getChannel() {
  if (!channel) {
    throw new Error('RabbitMQ channel not initialized');
  }

  return channel;
}

// Publish an event and wait for RabbitMQ confirmation
export async function publishEvent(routingKey, payload) {
  const channel = getChannel();

  return new Promise((resolve, reject) => {
    channel.publish(
      EXCHANGE,
      routingKey,
      Buffer.from(JSON.stringify(payload)),
      {
        persistent: true,
        contentType: 'application/json',
      },
      (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      }
    );
  });
}