import asyncHandler from '../../utils/asyncHandler.js';
import { publishSelectedRoute } from './routeMatching.service.js';

export const publishRoute = asyncHandler(async (req, res) => {
    const data = await publishSelectedRoute(req.body);
    res.status(201).json({
        success: true,
        message: 'Selected driver route published successfully',
        data
    });
});
