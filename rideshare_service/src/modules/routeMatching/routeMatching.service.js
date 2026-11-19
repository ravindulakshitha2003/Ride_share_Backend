import AppError from '../../utils/AppError.js';

import {
    saveSelectedDriverRoute,
    findMatchingRoutes
} from './routeMatching.repository.js';


// ==================================================
// Coordinate Validation
// ==================================================

function validCoordinates(lat, lng) {
    return (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
    );
}


// ==================================================
// Date Validation
// ==================================================

function validateDate(date) {
    if (
        typeof date !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date)
    ) {
        throw new AppError(
            'departureDate must be YYYY-MM-DD',
            400
        );
    }

    const parsed = new Date(`${date}T00:00:00Z`);

    if (
        Number.isNaN(parsed.getTime()) ||
        parsed.toISOString().slice(0, 10) !== date
    ) {
        throw new AppError(
            'Invalid departure date',
            400
        );
    }
}


// ==================================================
// Time Validation
// ==================================================

function validateTime(time) {
    if (
        typeof time !== 'string' ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
    ) {
        throw new AppError(
            'departureTime must be HH:mm',
            400
        );
    }
}


// ==================================================
// Timezone Offset
// ==================================================

function getTimezoneOffset() {
    const offset = process.env.APP_TIMEZONE_OFFSET || '+05:30';

    if (!/^[+-](0\d|1[0-4]):[0-5]\d$/.test(offset)) {
        throw new AppError(
            'Invalid APP_TIMEZONE_OFFSET',
            500
        );
    }

    return offset;
}


// ==================================================
// Departure Timestamp
// ==================================================

function departureTimestamp(date, time) {
    validateDate(date);
    validateTime(time);

    const offset = getTimezoneOffset();

    const parsed = new Date(
        `${date}T${time}:00${offset}`
    );

    if (Number.isNaN(parsed.getTime())) {
        throw new AppError(
            'Invalid departure date or time',
            400
        );
    }

    return parsed.toISOString();
}


// ==================================================
// GeoJSON Geometry Validation
// ==================================================

function validateGeometry(geometry) {

    if (
        !geometry ||
        geometry.type !== 'LineString' ||
        !Array.isArray(geometry.coordinates)
    ) {
        throw new AppError(
            'geometry must be a GeoJSON LineString',
            400
        );
    }


    if (geometry.coordinates.length < 2) {
        throw new AppError(
            'geometry must contain at least 2 coordinates',
            400
        );
    }


    const invalidCoordinates = geometry.coordinates.some(point => {

        if (
            !Array.isArray(point) ||
            point.length < 2
        ) {
            return true;
        }


        const lng = Number(point[0]);

        const lat = Number(point[1]);


        return !validCoordinates(lat, lng);
    });


    if (invalidCoordinates) {
        throw new AppError(
            'geometry coordinates must be [longitude, latitude] pairs in valid ranges',
            400
        );
    }
}


// ==================================================
// Publish Payload Validation
// ==================================================

function validatePayload(body) {

    if (
        !body ||
        !body.origin ||
        !body.destination ||
        !body.vehicleId ||
        !body.geometry
    ) {
        throw new AppError(
            'vehicleId, origin, destination and geometry are required',
            400
        );
    }


    // Validate origin

    const originLat = Number(body.origin.latitude);

    const originLng = Number(body.origin.longitude);


    if (!validCoordinates(originLat, originLng)) {
        throw new AppError(
            'Origin coordinates are invalid',
            400
        );
    }


    // Validate destination

    const destinationLat = Number(body.destination.latitude);

    const destinationLng = Number(body.destination.longitude);


    if (!validCoordinates(destinationLat, destinationLng)) {
        throw new AppError(
            'Destination coordinates are invalid',
            400
        );
    }


    // Validate place names

    if (
        !body.origin.placeName ||
        !body.destination.placeName
    ) {
        throw new AppError(
            'Origin and destination names are required',
            400
        );
    }


    // Validate geometry

    validateGeometry(body.geometry);


    // Validate distance

    if (
        !Number.isFinite(Number(body.distanceMeters)) ||
        Number(body.distanceMeters) <= 0
    ) {
        throw new AppError(
            'distanceMeters must be greater than zero',
            400
        );
    }


    // Validate duration

    if (
        !Number.isFinite(Number(body.durationSeconds)) ||
        Number(body.durationSeconds) <= 0
    ) {
        throw new AppError(
            'durationSeconds must be greater than zero',
            400
        );
    }


    // Validate seats

    const availableSeats = Number(body.availableSeats);

    if (
        !Number.isInteger(availableSeats) ||
        availableSeats < 1 ||
        availableSeats > 20
    ) {
        throw new AppError(
            'availableSeats must be an integer between 1 and 20',
            400
        );
    }


    // Validate price

    if (
        !Number.isFinite(Number(body.pricePerSeat)) ||
        Number(body.pricePerSeat) <= 0
    ) {
        throw new AppError(
            'pricePerSeat must be greater than zero',
            400
        );
    }


    // Validate departure date and time

    validateDate(body.departureDate);

    validateTime(body.departureTime);
}


// ==================================================
// Publish Selected Driver Route
// ==================================================

export async function publishSelectedRoute(body, userdata) {

    // 1. Validate frontend payload

    validatePayload(body);


    // 2. Get authenticated driver ID

    const driverId = userdata?.sub ?? userdata?.id;


    if (!driverId) {
        throw new AppError(
            'Authenticated driver ID is missing',
            401
        );
    }


    // 3. Convert departure date and time to UTC

    const departureAt = departureTimestamp(
        body.departureDate,
        body.departureTime
    );


    // 4. Prepare route data

    const routeData = {

        driverId: String(driverId),

        vehicleId: String(body.vehicleId),


        // Origin

        originName: String(body.origin.placeName),

        originLatitude: Number(body.origin.latitude),

        originLongitude: Number(body.origin.longitude),


        // Destination

        destinationName: String(body.destination.placeName),

        destinationLatitude: Number(body.destination.latitude),

        destinationLongitude: Number(body.destination.longitude),


        // GeoJSON route geometry

        geometry: {
            type: 'LineString',

            coordinates: body.geometry.coordinates.map(point => [
                Number(point[0]),
                Number(point[1])
            ])
        },


        // Route metrics

        distanceMeters: Number(body.distanceMeters),

        durationSeconds: Number(body.durationSeconds),


        // Ride information

        availableSeats: Number(body.availableSeats),

        pricePerSeat: Number(body.pricePerSeat),


        // Departure

        departureAt
    };


    // 5. Save route through repository

    const savedRoute = await saveSelectedDriverRoute(routeData);


    // 6. Return saved route to controller

    return savedRoute;
}


// ==================================================
// Search Matching Routes
// ==================================================

export async function searchRoutes(body) {

    // 1. Validate pickup and dropoff

    const { pickup, dropoff } = body || {};


    if (!pickup || !dropoff) {
        throw new AppError(
            'pickup and dropoff are required',
            400
        );
    }


    // 2. Pickup coordinates

    const pLat = Number(pickup.latitude);

    const pLng = Number(pickup.longitude);


    if (!validCoordinates(pLat, pLng)) {
        throw new AppError(
            'Pickup coordinates are invalid',
            400
        );
    }


    // 3. Dropoff coordinates

    const dLat = Number(dropoff.latitude);

    const dLng = Number(dropoff.longitude);


    if (!validCoordinates(dLat, dLng)) {
        throw new AppError(
            'Dropoff coordinates are invalid',
            400
        );
    }


    // 4. Validate requested seats

    const seats = body.seats === undefined
        ? 1
        : Number(body.seats);


    if (
        !Number.isInteger(seats) ||
        seats < 1 ||
        seats > 20
    ) {
        throw new AppError(
            'seats must be an integer between 1 and 20',
            400
        );
    }


    // 5. Validate maximum distance

    const maxDistanceMeters = body.maxDistanceMeters === undefined
        ? 5000
        : Number(body.maxDistanceMeters);


    if (
        !Number.isFinite(maxDistanceMeters) ||
        maxDistanceMeters <= 0 ||
        maxDistanceMeters > 50000
    ) {
        throw new AppError(
            'maxDistanceMeters must be between 1 and 50000',
            400
        );
    }


    // 6. Validate departure date

    const { departureDate, departureTime } = body;


    validateDate(departureDate);


    // 7. Get timezone offset

    const offset = getTimezoneOffset();


    // 8. Calculate search time window

    let from;

    let to;


    if (departureTime !== undefined) {

        // Validate requested time

        validateTime(departureTime);


        // Default search window: 60 minutes

        const windowMinutes = body.windowMinutes === undefined
            ? 60
            : Number(body.windowMinutes);


        if (
            !Number.isFinite(windowMinutes) ||
            windowMinutes < 0 ||
            windowMinutes > 1440
        ) {
            throw new AppError(
                'windowMinutes must be between 0 and 1440',
                400
            );
        }


        // Requested departure time

        const center = new Date(
            `${departureDate}T${departureTime}:00${offset}`
        );


        if (Number.isNaN(center.getTime())) {
            throw new AppError(
                'Invalid departure date or time',
                400
            );
        }


        // Before requested departure

        from = new Date(
            center.getTime() - windowMinutes * 60000
        );


        // After requested departure

        to = new Date(
            center.getTime() + windowMinutes * 60000
        );

    } else {

        // Search entire selected day

        from = new Date(
            `${departureDate}T00:00:00${offset}`
        );

        to = new Date(
            `${departureDate}T23:59:59${offset}`
        );


        if (
            Number.isNaN(from.getTime()) ||
            Number.isNaN(to.getTime())
        ) {
            throw new AppError(
                'Invalid departureDate',
                400
            );
        }
    }


    // 9. Search routes through repository

    return await findMatchingRoutes({

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