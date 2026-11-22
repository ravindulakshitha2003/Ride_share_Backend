import { Router } from 'express';
import { publishRoute, searchMatchingRoutes, getRoute, updateRideSeats } from './routeMatching.controller.js';

const router = Router();

router.post('/publish', publishRoute);
router.post('/search', searchMatchingRoutes);
router.get('/:id', getRoute);
router.patch('/:id/seats', updateRideSeats);

export default router;