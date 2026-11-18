
import 'dotenv/config';
import app from './app.js';
import { connectRabbitMQ } from './config/rabbitmq.js';
import { startOutboxWorker } from './workers/outboxWorker.js';

const PORT = Number(process.env.PORT || 5000);

async function startServer() {
    try {
        await connectRabbitMQ();

        // Start the Outbox Worker after RabbitMQ connects.
        startOutboxWorker();

        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Share-Ride API listening on port ${PORT}`);
        });

    } catch (error) {
        console.error(
            'Failed to start Ride Publishing Service:',
            error.message
        );

        process.exit(1);
    }
}

startServer();
