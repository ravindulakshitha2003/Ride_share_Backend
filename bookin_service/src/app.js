import express from 'express';
import bookingRoutes from './routes/bookingRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => {
  res.json({ success: true, service: 'booking-service', status: 'healthy' });
});

app.use('/api/v1/bookings', bookingRoutes);

app.use(errorHandler);

export default app;
