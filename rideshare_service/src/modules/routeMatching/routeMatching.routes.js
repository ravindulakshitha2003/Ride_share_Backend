import { Router } from 'express';
import { publishRoute } from './routeMatching.controller.js';
const router = Router();
router.post('/publish', publishRoute);
export default router;
