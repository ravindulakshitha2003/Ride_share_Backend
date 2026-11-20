import asyncHandler from '../../utils/asyncHandler.js';
import { publishSelectedRoute, searchRoutes } from './routeMatching.service.js';

import { sendMessage } from '../../producer/Producter.js';

export const publishRoute = asyncHandler(async (req, res) => {

  // 1. Save the route in the database.
  const data = await publishSelectedRoute(req.body, req.user);

  // 2. Publish an event to RabbitMQ.
//   await sendMessage(
//     'ROUTE_PUBLISHED',
//     'route.published',
//     {
//       route: data,
//       driverId: req.user.id
//     }
//   );

  // 3. Respond to the frontend.
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
