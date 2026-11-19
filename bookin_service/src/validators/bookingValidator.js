import { z } from 'zod';

const locationSchema = z.object({
  name: z.string().trim().min(1).max(255),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const matchedJourneySchema = z.object({
  matchId: z.string().trim().min(1),
  pickupMode: z.enum(['WALK_TO_ROUTE', 'DRIVER_DETOUR']),
  dropoffMode: z.enum(['WALK_TO_ROUTE', 'DRIVER_DETOUR']),
  pickupPoint: locationSchema,
  dropoffPoint: locationSchema,
  pickupWalkDistanceM: z.number().int().min(0).default(0),
  dropoffWalkDistanceM: z.number().int().min(0).default(0),
  extraDistanceM: z.number().int().min(0).default(0),
  extraDurationSeconds: z.number().int().min(0).default(0),
});

export const createBookingSchema = z.object({
  rideId: z.string().trim().min(1),
  requestedSeats: z.number().int().min(1).max(8),
  note: z.string().trim().max(1000).optional().nullable(),
  passengerJourney: z.object({
    origin: locationSchema,
    destination: locationSchema,
  }),
  matchedJourney: matchedJourneySchema,
});
