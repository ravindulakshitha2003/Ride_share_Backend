import asyncHandler from '../../utils/asyncHandler.js';
import { publishSelectedRoute, searchRoutes } from './routeMatching.service.js';

export const publishRoute = asyncHandler(async (req, res) => {

  // 1. Save the route + outbox event in one database transaction.
  //    The outbox worker polls and publishes events to RabbitMQ.
  const data = await publishSelectedRoute(req.body, req.user);

  // 2. Respond to the frontend.
  return res.status(201).json({
    success: true,
    message: 'Selected driver route published successfully',
    data
  });
});

export const searchMatchingRoutes = asyncHandler(async (req, res) => {
    const data = await searchRoutes(req.body);
    res.status(200).json({ success: true, count: data.length, data });
});
