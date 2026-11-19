
import amqp from 'amqplib';

let connection;
let channel;

export async function connectRabbitMQ() {
  connection = await amqp.connect(
    process.env.RABBITMQ_URL
  );

  channel = await connection.createConfirmChannel();

  await channel.assertExchange(
    'ride_exchange',
    'direct',
    { durable: true }
  );

  console.log('Connected to RabbitMQ');

  return channel;
}

export function getChannel() {
  if (!channel) {
    throw new Error('RabbitMQ channel not initialized');
  }

  return channel;
}
