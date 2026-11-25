// =============================================================================
// Booking mapper
// The database uses snake_case (pickup_point_name). JavaScript / the mobile app
// use camelCase (pickupPoint.name). This converts a DB row into the JSON shape
// the app receives, grouping related fields into small objects.
//
// Keeping this in one place means every endpoint returns the SAME shape, so
// the frontend can reuse one set of components.
// =============================================================================

// pg returns NUMERIC/float columns as numbers already, but be defensive.
const num = (value) => (value === null || value === undefined ? null : Number(value));

export function toBookingResponse(row) {
  return {
    bookingId: row.booking_id,
    rideId: row.ride_id,
    passengerId: row.passenger_id,
    driverId: row.driver_id,
    requestedSeats: row.requested_seats,
    note: row.note,
    status: row.status,

    // Where the passenger really wants to go (their own start / end)
    passengerJourney: {
      origin: {
        name: row.passenger_origin_name,
        latitude: num(row.passenger_origin_lat),
        longitude: num(row.passenger_origin_lng),
      },
      destination: {
        name: row.passenger_destination_name,
        latitude: num(row.passenger_destination_lat),
        longitude: num(row.passenger_destination_lng),
      },
    },

    // Where the DRIVER will actually pick up / drop off (from route matching)
    pickup: {
      name: row.pickup_point_name,
      latitude: num(row.pickup_lat),
      longitude: num(row.pickup_lng),
      mode: row.pickup_mode, // WALK_TO_ROUTE | DRIVER_DETOUR
      walkDistanceM: row.pickup_walk_distance_m,
    },
    dropoff: {
      name: row.dropoff_point_name,
      latitude: num(row.dropoff_lat),
      longitude: num(row.dropoff_lng),
      mode: row.dropoff_mode,
      walkDistanceM: row.dropoff_walk_distance_m,
    },

    // Cost to the driver of accepting (detour)
    detour: {
      extraDistanceM: row.extra_distance_m,
      extraDurationSeconds: row.extra_duration_seconds,
    },

    rejectReason: row.reject_reason ?? null,
    cancelReason: row.cancel_reason ?? null,
    cancelledBy: row.cancelled_by ?? null,
    respondedAt: row.responded_at ?? null,
    completedAt: row.completed_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toHistoryResponse(row) {
  return {
    previousStatus: row.previous_status,
    newStatus: row.new_status,
    changedBy: row.changed_by,
    reason: row.reason,
    changedAt: row.changed_at,
  };
}
