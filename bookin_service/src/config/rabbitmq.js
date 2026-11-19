import amqp from 'amqplib';

let connection;
let channel;

export async function connectRabbitMQ() {
  try {
    connection = await amqp.connect(
      process.env.RABBITMQ_URL
    );

    channel = await connection.createConfirmChannel();

    await channel.assertExchange(
      process.env.RABBITMQ_EXCHANGE,
      'topic',
      {
        durable: true,
      }
    );

    console.log('RabbitMQ connection successful');

    connection.on('close', () => {
      console.error('RabbitMQ connection closed');
    });

    connection.on('error', (error) => {
      console.error('RabbitMQ connection error:', error);
    });

    return channel;
  } catch (error) {
    console.error('RabbitMQ connection failed:', error);

    throw error;
  }
}

export async function publishEvent(
  routingKey,
  event
) {
  if (!channel) {
    throw new Error(
      'RabbitMQ channel is not initialized'
    );
  }

  const message = Buffer.from(
    JSON.stringify(event)
  );

  return new Promise((resolve, reject) => {
    channel.publish(
      process.env.RABBITMQ_EXCHANGE,
      routingKey,
      message,
      {
        persistent: true,
        contentType: 'application/json',
        timestamp: Date.now(),
      },
      (error) => {
        if (error) {
          return reject(error);
        }

        resolve();
      }
    );
  });
}