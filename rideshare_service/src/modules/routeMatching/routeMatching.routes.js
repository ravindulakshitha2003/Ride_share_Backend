import { Router } from 'express';
import { publishRoute, searchMatchingRoutes, getRoute } from './routeMatching.controller.js';

const router = Router();

router.post('/publish', publishRoute);
router.post('/search', searchMatchingRoutes);
router.get('/:id', getRoute);

export default router;