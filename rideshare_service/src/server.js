
import 'dotenv/config';
import app from './app.js';
import { connectRabbitMQ } from './config/rabbitmq.js';

const PORT = Number(process.env.PORT || 5000);

async function startServer() {
  try {
    // Connect RabbitMQ first.
    await connectRabbitMQ();

    // Start Express after successful connection.
    app.listen(PORT, () => {
      console.log(`Share-Ride API listening on port ${PORT}`);
    });

  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

startServer();
