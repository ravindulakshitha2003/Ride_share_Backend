import asyncHandler from '../../utils/asyncHandler.js';
import { publishSelectedRoute, searchRoutes } from './routeMatching.service.js';

export const publishRoute = asyncHandler(async (req, res) => {
    const data = await publishSelectedRoute(req.body);
    res.status(201).json({
        success: true,
        message: 'Selected driver route published successfully',
        data
    });
});

export const searchMatchingRoutes = asyncHandler(async (req, res) => {
    const data = await searchRoutes(req.body);
    res.status(200).json({ success: true, count: data.length, data });
});
