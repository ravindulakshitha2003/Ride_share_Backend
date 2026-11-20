// =============================================================================
// Input validation for lifecycle endpoints (zod, like your teammate's file).
// Rule: NEVER trust input from the app. Check types, lengths and allowed values
// before the data reaches the service or the database.
// =============================================================================

import { z } from 'zod';
import { BookingStatus } from '../domain/bookingStatus.js';
import { HttpError } from '../utils/httpError.js';

// booking_id is a UUID in the DB. Checking it here gives a clean 400 instead of
// a PostgreSQL "invalid input syntax for type uuid" 500 error.
export const bookingIdParamSchema = z.object({
  bookingId: z.string().uuid('bookingId must be a valid UUID'),
});

// GET /driver/requests?status=PENDING&rideId=...&limit=20&offset=0
// Query-string values always arrive as strings, so z.coerce converts "20" -> 20.
export const driverListQuerySchema = z.object({
  status: z.nativeEnum(BookingStatus).default(BookingStatus.PENDING),
  rideId: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// Body for reject / cancel: { "reason": "Car is full" }  (reason is optional)
export const reasonBodySchema = z
  .object({
    reason: z.string().trim().max(500).optional().nullable(),
  })
  .default({});

/**
 * Run a zod schema and either return clean data or throw a 400 HttpError
 * in the same { field, message } format your teammate's controller uses.
 */
export function validate(schema, input) {
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    throw new HttpError(400, 'Invalid request', {
      code: 'VALIDATION_ERROR',
      errors: parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }

  return parsed.data;
}
