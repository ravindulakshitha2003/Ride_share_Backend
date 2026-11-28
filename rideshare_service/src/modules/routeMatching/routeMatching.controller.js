import asyncHandler from "../../utils/asyncHandler.js";
import {
  publishSelectedRoute,
  searchRoutes,
  getRouteDetails
} from "./routeMatching.service.js";
import { sendMessage } from '../../producer/Producter.js';
import { updateSeatsById } from './routeMatching.repository.js';

export const publishRoute = asyncHandler(async (req, res) => {
  const driverId = req.user?.sub || req.user?.id;

  // 1. Save the route and intermediate stops in PostgreSQL
  const data = await publishSelectedRoute(req.body, req.user);

  // 2. Publish event to RabbitMQ
  await sendMessage(
    'ROUTE_PUBLISHED',
    'route.published',
    {
      route: data,
      driverId
    }
  );

  // 3. Respond to frontend
  return res.status(201).json({
    success: true,
    message: 'Selected driver route published successfully',
    data
  });
});

export const searchMatchingRoutes = asyncHandler(async (req, res) => {
  const data = await searchRoutes(req.body);


     console.log(data);

  res.status(200).json({
    success: true,
    count: data.length,
    data,
  });
});

export const getRoute = asyncHandler(async (req, res) => {
  const data = await getRouteDetails(req.params.id);

  res.status(200).json({
    success: true,
    data
  });
});

export const updateRideSeats = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const delta = Number(req.body?.delta);

  if (!Number.isInteger(delta) || delta === 0) {
    return res.status(400).json({ success: false, message: 'delta must be a non-zero integer' });
  }

  const updated = await updateSeatsById(id, delta);

  if (!updated) {
    return res.status(404).json({ success: false, message: 'Route not found' });
  }

  return res.status(200).json({ success: true, data: updated });
});