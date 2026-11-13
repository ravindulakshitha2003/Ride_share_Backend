import AppError from '../../utils/AppError.js';
import { saveSelectedDriverRoute } from './routeMatching.repository.js';

function validCoordinates(lat, lng) {
    return Number.isFinite(lat) && Number.isFinite(lng) &&
        lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function departureTimestamp(date, time) {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new AppError('departureDate must be YYYY-MM-DD', 400);
    }
    if (typeof time !== 'string' || !/^\d{2}:\d{2}$/.test(time)) {
        throw new AppError('departureTime must be HH:mm', 400);
    }

    const offset = process.env.APP_TIMEZONE_OFFSET || '+05:30';
    if (!/^[+-](0\d|1[0-4]):[0-5]\d$/.test(offset)) {
        throw new AppError('Invalid APP_TIMEZONE_OFFSET', 500);
    }

    const parsed = new Date(`${date}T${time}:00${offset}`);
    if (Number.isNaN(parsed.getTime())) {
        throw new AppError('Invalid departure date or time', 400);
    }
    return parsed.toISOString();
}

// OSRM GeoJSON LineString: { type: 'LineString', coordinates: [[lng, lat], ...] }
function validateGeometry(geometry) {
    if (!geometry || geometry.type !== 'LineString' || !Array.isArray(geometry.coordinates)) {
        throw new AppError('geometry must be a GeoJSON LineString', 400);
    }
    if (geometry.coordinates.length < 2) {
        throw new AppError('geometry must contain at least 2 coordinates', 400);
    }
    const bad = geometry.coordinates.some(point =>
        !Array.isArray(point) || point.length < 2 ||
        !validCoordinates(Number(point[1]), Number(point[0]))
    );
    if (bad) {
        throw new AppError('geometry coordinates must be [longitude, latitude] pairs in valid ranges', 400);
    }
}

function validatePayload(body) {
    if (!body || !body.origin || !body.destination || !body.vehicleId || !body.geometry) {
        throw new AppError('vehicleId, origin, destination and geometry are required', 400);
    }
    if (!validCoordinates(Number(body.origin.latitude), Number(body.origin.longitude)) ||
        !validCoordinates(Number(body.destination.latitude), Number(body.destination.longitude))) {
        throw new AppError('Origin or destination coordinates are invalid', 400);
    }
    validateGeometry(body.geometry);

    if (!Number.isFinite(Number(body.distanceMeters)) || Number(body.distanceMeters) <= 0) {
        throw new AppError('distanceMeters must be greater than zero', 400);
    }
    if (!Number.isFinite(Number(body.durationSeconds)) || Number(body.durationSeconds) <= 0) {
        throw new AppError('durationSeconds must be greater than zero', 400);
    }
    if (!Number.isInteger(Number(body.availableSeats)) ||
        Number(body.availableSeats) < 1 || Number(body.availableSeats) > 20) {
        throw new AppError('availableSeats must be an integer between 1 and 20', 400);
    }
    if (!Number.isFinite(Number(body.pricePerSeat)) || Number(body.pricePerSeat) <= 0) {
        throw new AppError('pricePerSeat must be greater than zero', 400);
    }
    if (!body.departureDate || !body.departureTime) {
        throw new AppError('departureDate and departureTime are required', 400);
    }
}

export async function publishSelectedRoute(body) {
    validatePayload(body);

    const driverId = process.env.TEMP_DRIVER_ID;
    if (!driverId) throw new AppError('TEMP_DRIVER_ID is not configured', 500);

    return saveSelectedDriverRoute({
        driverId,
        vehicleId: String(body.vehicleId),
        originName: String(body.origin.placeName || 'Unknown origin'),
        originLatitude: Number(body.origin.latitude),
        originLongitude: Number(body.origin.longitude),
        destinationName: String(body.destination.placeName || 'Unknown destination'),
        destinationLatitude: Number(body.destination.latitude),
        destinationLongitude: Number(body.destination.longitude),
        geometry: {
            type: 'LineString',
            coordinates: body.geometry.coordinates.map(p => [Number(p[0]), Number(p[1])])
        },
        distanceMeters: Number(body.distanceMeters),
        durationSeconds: Number(body.durationSeconds),
        intermediateStops: [],
        departureAt: departureTimestamp(body.departureDate, body.departureTime),
        availableSeats: Number(body.availableSeats),
        pricePerSeat: Number(body.pricePerSeat),
        currency: 'LKR'
    });
}

import { findMatchingRoutes } from './routeMatching.repository.js';

function tzOffset() {
    const offset = process.env.APP_TIMEZONE_OFFSET || '+05:30';
    if (!/^[+-](0\d|1[0-4]):[0-5]\d$/.test(offset)) {
        throw new AppError('Invalid APP_TIMEZONE_OFFSET', 500);
    }
    return offset;
}

export async function searchRoutes(body) {
    const { pickup, dropoff } = body || {};
    if (!pickup || !dropoff) throw new AppError('pickup and dropoff are required', 400);

    const pLat = Number(pickup.latitude), pLng = Number(pickup.longitude);
    const dLat = Number(dropoff.latitude), dLng = Number(dropoff.longitude);
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
    if (typeof departureDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(departureDate)) {
        throw new AppError('departureDate must be YYYY-MM-DD', 400);
    }

    const offset = tzOffset();
    let from, to;
    if (departureTime !== undefined) {
        if (typeof departureTime !== 'string' || !/^\d{2}:\d{2}$/.test(departureTime)) {
            throw new AppError('departureTime must be HH:mm', 400);
        }
        const windowMinutes = body.windowMinutes === undefined ? 60 : Number(body.windowMinutes);
        if (!Number.isFinite(windowMinutes) || windowMinutes < 0 || windowMinutes > 1440) {
            throw new AppError('windowMinutes must be between 0 and 1440', 400);
        }
        const center = new Date(`${departureDate}T${departureTime}:00${offset}`);
        if (Number.isNaN(center.getTime())) throw new AppError('Invalid departure date or time', 400);
        from = new Date(center.getTime() - windowMinutes * 60000);
        to = new Date(center.getTime() + windowMinutes * 60000);
    } else {
        from = new Date(`${departureDate}T00:00:00${offset}`);
        to = new Date(`${departureDate}T23:59:59${offset}`);
        if (Number.isNaN(from.getTime())) throw new AppError('Invalid departureDate', 400);
    }

    return findMatchingRoutes({
        pickupLat: pLat, pickupLng: pLng, dropoffLat: dLat, dropoffLng: dLng,
        seats, departFrom: from.toISOString(), departTo: to.toISOString(), maxDistanceMeters
    });
}
