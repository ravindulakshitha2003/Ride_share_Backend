import express from 'express';
import cors from 'cors';
import bookingRoutes from './modules/bookings/booking.routes.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(cors());
app.use(express.json());

// Simple health endpoint for local checks and service monitoring.
app.get('/health', (req, res) => {
  res.json({ service: 'booking-service', status: 'OK' });
});

app.use('/api/v1/bookings', bookingRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
