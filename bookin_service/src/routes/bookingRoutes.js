import { Router } from 'express';
import { createBookingController } from '../controllers/bookingController.js';
import { passengerIdentity } from '../middleware/passengerIdentity.js';

const router = Router();

router.post('/', passengerIdentity, createBookingController);

export default router;
