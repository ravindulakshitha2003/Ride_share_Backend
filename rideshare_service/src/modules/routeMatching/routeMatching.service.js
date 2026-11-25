import AppError from '../../utils/AppError.js';
import {
    saveSelectedDriverRoute,
    findMatchingRoutes,
    findRouteById
} from './routeMatching.repository.js';
import { randomUUID } from 'node:crypto';

// (Keep existing validCoordinates, validDate, validTime, tzOffset, departureTimestamp, validateGeometry functions)
function validCoordinates(lat, lng) {
    return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function validDate(date) {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const parsed = new Date(`${date}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

function validTime(time) {
    return typeof time === 'string' && /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
}

function tzOffset() {
    const offset = process.env.APP_TIMEZONE_OFFSET || '+05:30';
    const validOffset = /^[+-](?:0\d|1[0-3]):[0-5]\d$/.test(offset) || /^[+-]14:00$/.test(offset);
    if (!validOffset) throw new AppError('Invalid APP_TIMEZONE_OFFSET', 500);
    return offset;
}

function departureTimestamp(date, time) {
    if (!validDate(date)) throw new AppError('departureDate must be a valid YYYY-MM-DD date', 400);
    if (!validTime(time)) throw new AppError('departureTime must be a valid HH:mm time', 400);
    const offset = tzOffset();
    const parsed = new Date(`${date}T${time}:00${offset}`);
    if (Number.isNaN(parsed.getTime())) throw new AppError('Invalid departure date or time', 400);
    return parsed.toISOString();
}

function validateGeometry(geometry) {
    if (!geometry || geometry.type !== 'LineString' || !Array.isArray(geometry.coordinates)) {
        throw new AppError('geometry must be a GeoJSON LineString', 400);
    }
    if (geometry.coordinates.length < 2) {
        throw new AppError('geometry must contain at least 2 coordinates', 400);
    }
    const badCoordinate = geometry.coordinates.some(point => {
        if (!Array.isArray(point) || point.length < 2) return true;
        return !validCoordinates(Number(point[1]), Number(point[0]));
    });
    if (badCoordinate) {
        throw new AppError('geometry coordinates must be [longitude, latitude] pairs in valid ranges', 400);
    }
}

function validatePayload(body) {
    if (!body || !body.origin || !body.destination || !body.vehicleId || !body.geometry) {
        throw new AppError('vehicleId, origin, destination and geometry are required', 400);
    }
    if (
        !validCoordinates(Number(body.origin.latitude), Number(body.origin.longitude)) ||
        !validCoordinates(Number(body.destination.latitude), Number(body.destination.longitude))
    ) {
        throw new AppError('Origin or destination coordinates are invalid', 400);
    }
    if (typeof body.origin.placeName !== 'string' || !body.origin.placeName.trim()) {
        throw new AppError('origin.placeName is required', 400);
    }
    if (typeof body.destination.placeName !== 'string' || !body.destination.placeName.trim()) {
        throw new AppError('destination.placeName is required', 400);
    }

    validateGeometry(body.geometry);

    if (!Number.isFinite(Number(body.distanceMeters)) || Number(body.distanceMeters) <= 0) {
        throw new AppError('distanceMeters must be greater than zero', 400);
    }
    if (!Number.isFinite(Number(body.durationSeconds)) || Number(body.durationSeconds) <= 0) {
        throw new AppError('durationSeconds must be greater than zero', 400);
    }
    if (!Number.isInteger(Number(body.availableSeats)) || Number(body.availableSeats) < 1 || Number(body.availableSeats) > 20) {
        throw new AppError('availableSeats must be an integer between 1 and 20', 400);
    }
    if (!Number.isFinite(Number(body.pricePerSeat)) || Number(body.pricePerSeat) <= 0) {
        throw new AppError('pricePerSeat must be greater than zero', 400);
    }
    if (!body.departureDate || !body.departureTime) {
        throw new AppError('departureDate and departureTime are required', 400);
    }
    if (!validDate(body.departureDate)) {
        throw new AppError('departureDate must be a valid YYYY-MM-DD date', 400);
    }
    if (!validTime(body.departureTime)) {
        throw new AppError('departureTime must be a valid HH:mm time', 400);
    }
}

export async function publishSelectedRoute(body, userdata) {
    validatePayload(body);

    const driverId = String(userdata?.sub || userdata?.id || '');
    if (!driverId) {
        throw new AppError('Authenticated user ID is missing', 401);
    }

    return saveSelectedDriverRoute(
        {
            driverId,
            vehicleId: String(body.vehicleId),
            originName: String(body.origin.placeName),
            originLatitude: Number(body.origin.latitude),
            originLongitude: Number(body.origin.longitude),
            destinationName: String(body.destination.placeName),
            destinationLatitude: Number(body.destination.latitude),
            destinationLongitude: Number(body.destination.longitude),
            geometry: {
                type: 'LineString',
                coordinates: body.geometry.coordinates.map(point => [
                    Number(point[0]),
                    Number(point[1])
                ])
            },
            distanceMeters: Number(body.distanceMeters),
            durationSeconds: Number(body.durationSeconds),
            departureAt: departureTimestamp(body.departureDate, body.departureTime),
            availableSeats: Number(body.availableSeats),
            pricePerSeat: Number(body.pricePerSeat),
            currency: 'LKR',
            intermediateStops: Array.isArray(body.intermediateStops) ? body.intermediateStops : [],
            ridePreferences: body.ridePreferences || {},
            maxPassengerWaitingMinutes: body.maxPassengerWaitingMinutes !== undefined ? Number(body.maxPassengerWaitingMinutes) : 5
        },
        (savedRide) => ({
            eventId: randomUUID(),
            eventType: 'ride.published',
            recipientUserId: String(savedRide.driver_id),
            title: 'Ride published successfully',
            body: `Your ride from ${savedRide.origin_name} to ${savedRide.destination_name} has been published successfully.`,
            data: {
                rideId: String(savedRide.route_id),
                origin: savedRide.origin_name,
                destination: savedRide.destination_name,
                ridePreferences: savedRide.ride_preferences,
                intermediateStops: savedRide.intermediate_stops
            }
        })
    );
}

export async function getRouteDetails(routeId) {
    const route = await findRouteById(routeId);
    if (!route) {
        throw new AppError('Route not found', 404);
    }
    return route;
}

// (Keep existing searchRoutes function unchanged)
export async function searchRoutes(body) {
    const { pickup, dropoff } = body || {};
    if (!pickup || !dropoff) throw new AppError('pickup and dropoff are required', 400);

    const pLat = Number(pickup.latitude);
    const pLng = Number(pickup.longitude);
    const dLat = Number(dropoff.latitude);
    const dLng = Number(dropoff.longitude);

    if (!validCoordinates(pLat, pLng) || !validCoordinates(dLat, dLng)) {
        throw new AppError('pickup or dropoff coordinates are invalid', 400);
    }

    const seats = body.seats === undefined ? 1 : Number(body.seats);
    if (!Number.isInteger(seats) || seats < 1 || seats > 20) {
        throw new AppError('seats must be an integer between 1 and 20', 400);
    }

    const maxDistanceMeters = body.maxDistanceMeters === undefined ? 5000 : Number(body.maxDistanceMeters);
    if (!Number.isFinite(maxDistanceMeters) || maxDistanceMeters <= 0 || maxDistanceMeters > 50000) {
        throw new AppError('maxDistanceMeters must be between 1 and 50000', 400);
    }

    const { departureDate, departureTime } = body;
    if (!validDate(departureDate)) throw new AppError('departureDate must be a valid YYYY-MM-DD date', 400);

    const offset = tzOffset();
    let from, to;

    if (departureTime !== undefined) {
        if (!validTime(departureTime)) throw new AppError('departureTime must be a valid HH:mm time', 400);
        const windowMinutes = body.windowMinutes === undefined ? 60 : Number(body.windowMinutes);
        const center = new Date(`${departureDate}T${departureTime}:00${offset}`);
        from = new Date(center.getTime() - windowMinutes * 60000);
        to = new Date(center.getTime() + windowMinutes * 60000);
    } else {
        from = new Date(`${departureDate}T00:00:00${offset}`);
        to = new Date(`${departureDate}T23:59:59${offset}`);
    }

    return findMatchingRoutes({
        pickupLat: pLat,
        pickupLng: pLng,
        dropoffLat: dLat,
        dropoffLng: dLng,
        seats,
        departFrom: from.toISOString(),
        departTo: to.toISOString(),
        maxDistanceMeters
    });
}