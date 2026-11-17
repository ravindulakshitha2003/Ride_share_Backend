
import { randomUUID } from "node:crypto";

import asyncHandler from "../../utils/asyncHandler.js";
import {
  publishSelectedRoute,
  searchRoutes,
} from "./routeMatching.service.js";

import { publishEvent } from "../../config/rabbitmq.js";

export const publishRoute = asyncHandler(async (req, res) => {
  // 1. Save the ride in PostgreSQL
  const data = await publishSelectedRoute(req.body);

  // 2. Check the saved ride details
  if (!data?.driver_id || !data?.route_id) {
    throw new Error(
      "Saved ride is missing driver_id or route_id"
    );
  }

  // 3. Create the notification event
  const event = {
    eventId: randomUUID(),
    eventType: "ride.published",
    recipientUserId: String(data.driver_id),
    title: "Ride published successfully",
    body: `Your ride from ${data.origin_name} to ${data.destination_name} has been published successfully.`,
    data: {
      rideId: String(data.route_id),
      origin: data.origin_name,
      destination: data.destination_name,
    },
  };

  // 4. Send the event to RabbitMQ
  await publishEvent("ride.published", event);

  // 5. Return the API response
  res.status(201).json({
    success: true,
    message: "Selected driver route published successfully",
    data,
  });
});

export const searchMatchingRoutes = asyncHandler(async (req, res) => {
  const data = await searchRoutes(req.body);

  res.status(200).json({
    success: true,
    count: data.length,
    data,
  });
});
