import AppError from '../../utils/AppError.js';

const OSRM_BASE_URL = (
    process.env.OSRM_BASE_URL || 'https://router.project-osrm.org'
).replace(/\/$/, '');

export async function getDrivingRouteAlternatives(origin, destination) {
    const coordinates = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
    const url = `${OSRM_BASE_URL}/route/v1/driving/${coordinates}?alternatives=true&overview=full&geometries=geojson`;

    let response;
    try {
        response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    } catch (error) {
        throw new AppError(`Could not connect to OSRM: ${error.message}`, 502);
    }
    if (!response.ok) throw new AppError(`OSRM returned HTTP ${response.status}`, 502);

    const data = await response.json();
    if (data.code !== 'Ok' || !Array.isArray(data.routes)) {
        throw new AppError(data.message || 'OSRM could not find a route', 422);
    }
    return data.routes;
}
