import asyncHandler from '../../utils/asyncHandler.js';

import {
    publishSelectedRoute,
    searchRoutes
} from './routeMatching.service.js';

import { sendMessage } from '../../producer/Producter.js';


export const publishRoute = asyncHandler(async (req, res) => {

    // 1. Save the selected driver route in PostgreSQL
    const data = await publishSelectedRoute(
        req.body,
        req.user
    );

    // 2. Publish an event to RabbitMQ
    await sendMessage(
        'ROUTE_PUBLISHED',
        'route.published',
        {
            route: data,
            driverId: String(req.user.sub ?? req.user.id)
        }
    );

    // 3. Return the saved route to the frontend
    return res.status(201).json({
        success: true,
        message: 'Selected driver route published successfully',
        data
    });
});


export const searchMatchingRoutes = asyncHandler(async (req, res) => {

    // 1. Search for matching routes
    const data = await searchRoutes(req.body);

    // 2. Return matching routes
    return res.status(200).json({
        success: true,
        count: data.length,
        data
    });
});