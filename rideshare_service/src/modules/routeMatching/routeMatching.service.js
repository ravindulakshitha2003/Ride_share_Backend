import { createHash, timingSafeEqual } from 'node:crypto';
import AppError from '../../utils/AppError.js';
import { getDrivingRouteAlternatives } from '../../services/routing/osrm.service.js';
import { saveSelectedDriverRoute } from './routeMatching.repository.js';

function validCoordinates(lat, lng) {
    return Number.isFinite(lat) && Number.isFinite(lng) &&
        lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

// Keep these property names and order identical to the frontend fingerprint function.
function createRouteSignature(route, origin, destination) {
    const routeData = {
        origin,
        destination,
        geometry: route.geometry,
        distance: route.distance,
        duration: route.duration,
        weight: route.weight,
        weight_name: route.weight_name,
        profile: 'driving'
    };
    return createHash('sha256').update(JSON.stringify(routeData)).digest('hex');
}

function signaturesMatch(received, generated) {
    if (typeof received !== 'string' || !/^[a-f0-9]{64}$/i.test(received)) return false;
    const a = Buffer.from(received.toLowerCase(), 'hex');
    const b = Buffer.from(generated, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
}


function departureTimestamp(date, time) {
    // Validate date format: YYYY-MM-DD
    if (
        typeof date !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date)
    ) {
        throw new AppError(
            'departureDate must be YYYY-MM-DD',
            400
        );
    }

    // Validate time format: HH:mm
    if (
        typeof time !== 'string' ||
        !/^\d{2}:\d{2}$/.test(time)
    ) {
        throw new AppError(
            'departureTime must be HH:mm',
            400
        );
    }

    const offset = process.env.APP_TIMEZONE_OFFSET || '+05:30';

    if (!/^[+-](0\d|1[0-4]):[0-5]\d$/.test(offset)) {
        throw new AppError(
            'Invalid APP_TIMEZONE_OFFSET',
            500
        );
    }

    const parsed = new Date(`${date}T${time}:00${offset}`);

    if (Number.isNaN(parsed.getTime())) {
        throw new AppError('Invalid departure date or time', 400);
    }

    return parsed.toISOString();
}


function validatePayload(body) {
    if (!body.routeSignature || !body.origin || !body.destination || !body.vehicleId) {
        throw new AppError('routeSignature, origin, destination and vehicleId are required', 400);
    }
    const origin = body.origin;
    const destination = body.destination;
    if (!validCoordinates(Number(origin.latitude), Number(origin.longitude)) ||
        !validCoordinates(Number(destination.latitude), Number(destination.longitude))) {
        throw new AppError('Origin or destination coordinates are invalid', 400);
    }
    if (body.profile !== 'driving') throw new AppError('Only the driving profile is supported', 400);
    if (!Number.isInteger(Number(body.availableSeats)) ||
        Number(body.availableSeats) < 1 || Number(body.availableSeats) > 20) {
        throw new AppError('availableSeats must be an integer between 1 and 20', 400);
    }
    if (!Number.isFinite(Number(body.pricePerSeat)) || Number(body.pricePerSeat) <= 0) {
        throw new AppError('pricePerSeat must be greater than zero', 400);
    }
    if (!/^([a-f0-9]{64})$/i.test(body.routeSignature)) {
        throw new AppError('routeSignature must be a 64-character SHA-256 hex string', 400);
    }
    if (!body.departureDate || !body.departureTime) {
        throw new AppError('departureDate and departureTime are required', 400);
    }
}

export async function publishSelectedRoute(body) {
    validatePayload(body);

    // The frontend hashes coordinate-only origin/destination objects.
    const origin = {
        latitude: Number(body.origin.latitude),
        longitude: Number(body.origin.longitude)
    };
    const destination = {
        latitude: Number(body.destination.latitude),
        longitude: Number(body.destination.longitude)
    };

    const routes = await getDrivingRouteAlternatives(origin, destination);
    const selectedRoute = routes.find(route =>
        signaturesMatch(body.routeSignature, createRouteSignature(route, origin, destination))
    );

    if (!selectedRoute) {
        throw new AppError('Selected route could not be verified. Fetch route options again and retry.', 409);
    }
    if (!selectedRoute.geometry || selectedRoute.geometry.type !== 'LineString' ||
        !Array.isArray(selectedRoute.geometry.coordinates) ||
        selectedRoute.geometry.coordinates.length < 2) {
        throw new AppError('Selected OSRM route has invalid geometry', 422);
    }

    const driverId = process.env.TEMP_DRIVER_ID;
    if (!driverId) throw new AppError('TEMP_DRIVER_ID is not configured', 500);

    return saveSelectedDriverRoute({
        driverId,
        vehicleId: String(body.vehicleId),
        routeSignature: body.routeSignature.toLowerCase(),
        originName: String(body.origin.placeName || 'Unknown origin'),
        originLatitude: origin.latitude,
        originLongitude: origin.longitude,
        destinationName: String(body.destination.placeName || 'Unknown destination'),
        destinationLatitude: destination.latitude,
        destinationLongitude: destination.longitude,
        geometry: selectedRoute.geometry,
        distanceMeters: selectedRoute.distance,
        durationSeconds: selectedRoute.duration,
        intermediateStops: [],
        departureAt: departureTimestamp(body.departureDate, body.departureTime),
        availableSeats: Number(body.availableSeats),
        pricePerSeat: Number(body.pricePerSeat),
        currency: 'LKR'
    });
}
