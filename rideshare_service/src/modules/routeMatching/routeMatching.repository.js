import pool from '../../db/pool.js';
import { FIND_MATCHING_ROUTES, GET_ROUTE_BY_ID } from './routeMatching.sql.js';

export async function saveSelectedDriverRoute(routeData, createEvent) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Save the main route in driver_routes
        const routeQuery = `
            INSERT INTO driver_routes (
                driver_id,
                driver_name,
                vehicle_id,

                origin_name,
                origin_latitude,
                origin_longitude,

                destination_name,
                destination_latitude,
                destination_longitude,

                route_line,
                distance_meters,
                duration_seconds,

                departure_at,
                available_seats,

                price_per_seat,
                currency,
                status,

                ride_preferences,
                max_passenger_waiting_minutes,

                no_of_requests,
                no_of_bookings
            )
            VALUES (
                $1, $2, $3,
                $4, $5, $6,
                $7, $8, $9,
                ST_SetSRID(ST_GeomFromGeoJSON($10), 4326),
                $11, $12,
                $13, $14,
                $15, $16, 'PUBLISHED',
                $17::jsonb, $18,
                $19, $20
            )
            RETURNING
                route_id,
                driver_id,
                driver_name,
                vehicle_id,

                origin_name,
                origin_latitude,
                origin_longitude,

                destination_name,
                destination_latitude,
                destination_longitude,

                ST_AsGeoJSON(route_line)::json AS route_geometry,

                distance_meters,
                duration_seconds,
                departure_at,
                available_seats,

                price_per_seat,
                currency,

                ride_preferences,
                max_passenger_waiting_minutes,

                no_of_requests,
                no_of_bookings,

                status,
                created_at;
        `;

        const routeValues = [
            routeData.driverId,
            routeData.driverName,
            routeData.vehicleId,

            routeData.originName,
            routeData.originLatitude,
            routeData.originLongitude,

            routeData.destinationName,
            routeData.destinationLatitude,
            routeData.destinationLongitude,

            JSON.stringify(routeData.geometry),

            routeData.distanceMeters,
            routeData.durationSeconds,

            routeData.departureAt,
            routeData.availableSeats,

            routeData.pricePerSeat,
            routeData.currency,

            JSON.stringify(routeData.ridePreferences || {}),
            routeData.maxPassengerWaitingMinutes ?? 5,

            0,
            0
        ];

        const result = await client.query(routeQuery, routeValues);
        const savedRide = result.rows[0];

        // 2. Save intermediate stops
        const savedStops = [];

        if (
            Array.isArray(routeData.intermediateStops) &&
            routeData.intermediateStops.length > 0
        ) {
            for (let i = 0; i < routeData.intermediateStops.length; i++) {
                const stop = routeData.intermediateStops[i];

                const stopQuery = `
                    INSERT INTO driver_route_stops (
                        route_id,
                        stop_order,
                        location,
                        reason,
                        arrival_time,
                        duration_minutes,
                        description,
                        flexible_time
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    RETURNING
                        stop_id,
                        route_id,
                        stop_order,
                        location,
                        reason,
                        arrival_time,
                        duration_minutes,
                        description,
                        flexible_time;
                `;

                const stopValues = [
                    savedRide.route_id,
                    i + 1,
                    stop.location || '',
                    stop.reason || null,
                    stop.arrivalTime || null,
                    Number(stop.durationMinutes) || 0,
                    stop.description || null,
                    Boolean(stop.flexibleTime)
                ];

                const stopRes = await client.query(stopQuery, stopValues);
                savedStops.push(stopRes.rows[0]);
            }
        }

        savedRide.intermediate_stops = savedStops;

        // 3. Build notification event
        const event = createEvent(savedRide);

        // 4. Save event in Outbox table
        const outboxQuery = `
            INSERT INTO outbox_events (
                event_id,
                aggregate_type,
                aggregate_id,
                event_type,
                routing_key,
                payload
            )
            VALUES ($1, $2, $3, $4, $5, $6::jsonb);
        `;

        await client.query(outboxQuery, [
            event.eventId,
            'ride',
            savedRide.route_id,
            event.eventType,
            'ride.published',
            JSON.stringify(event)
        ]);

        // 5. Commit transaction
        await client.query('COMMIT');

        return savedRide;

    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch (rollbackError) {
            console.error(
                'Transaction rollback failed:',
                rollbackError.message
            );
        }

        throw error;

    } finally {
        client.release();
    }
}

export async function findMatchingRoutes(p) {
    const result = await pool.query(FIND_MATCHING_ROUTES, [
        p.pickupLng, p.pickupLat, p.dropoffLng, p.dropoffLat,
        p.seats, p.departFrom, p.departTo, p.maxDistanceMeters
    ]);
    return result.rows;
}

export async function findRouteById(routeId) {
    const result = await pool.query(GET_ROUTE_BY_ID, [routeId]);
    return result.rows[0] || null;
}

export async function updateSeatsById(routeId, delta) {
  const result = await pool.query(
    `UPDATE driver_routes
        SET available_seats = GREATEST(0, available_seats + $2),
            updated_at = NOW()
      WHERE route_id = $1
      RETURNING route_id, available_seats, status`,
    [routeId, delta]
  );
  return result.rows[0] || null;
}