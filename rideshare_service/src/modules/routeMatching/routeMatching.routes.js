import { Router } from 'express';
import { publishRoute, searchMatchingRoutes } from './routeMatching.controller.js';
const router = Router();
router.post('/publish', publishRoute);
router.post('/search', searchMatchingRoutes);
export default router;
