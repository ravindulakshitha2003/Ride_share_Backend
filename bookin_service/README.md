# Share-Ride Booking Service

Starter implementation using Node.js, Express, PostgreSQL and RabbitMQ.

## 1. Responsibilities

- Booking Service owns booking requests and booking statuses.
- Ride Service owns published rides and available seat inventory.
- Booking Service never connects directly to the Ride Service database.
- Notification Service consumes booking events from RabbitMQ and sends notifications.

## 2. Setup

1. Create a separate PostgreSQL database named `booking_db`.
2. Copy `.env.example` to `.env` and update the values.
3. Install packages: `npm install`.
4. Run migrations: `npm run migrate`.
5. Start RabbitMQ and make sure the Ride Service API contract below exists.
6. Start the service: `npm run dev`.

## 3. Authentication assumptions

This starter expects a JWT containing:
- `userId` (or `id` or `sub`)
- `role`, with values `PASSENGER` or `DRIVER`

Adjust `src/middleware/auth.middleware.js` to match the token claims and role names used by your Identity Service.

## 4. Booking Service public APIs

All routes require `Authorization: Bearer <JWT>`.

| Method | URL | Role | Purpose |
|---|---|---|---|
| POST | `/api/v1/bookings` | PASSENGER | Create booking request |
| GET | `/api/v1/bookings/my` | PASSENGER | List own bookings |
| GET | `/api/v1/bookings/driver/pending` | DRIVER | List pending requests assigned to driver |
| GET | `/api/v1/bookings/:bookingId` | Passenger or assigned driver | Get booking |
| PATCH | `/api/v1/bookings/:bookingId/accept` | DRIVER | Accept and reserve seats |
| PATCH | `/api/v1/bookings/:bookingId/reject` | DRIVER | Reject request |
| PATCH | `/api/v1/bookings/:bookingId/cancel` | PASSENGER | Cancel own booking |

### Create booking request

`POST /api/v1/bookings`

```json
{
  "rideId": "UUID-OF-RIDE",
  "seats": 2
}
```

Passenger identity comes from the JWT, not from the request body.

### Reject booking

`PATCH /api/v1/bookings/:bookingId/reject`

```json
{
  "reason": "Schedule does not work"
}
```

## 5. Required Ride Service internal API contract

These are APIs Booking Service calls. The Ride Service team must implement them.
The URL names are proposed contracts; align them with your existing Ride Service routes.

### A. Get ride information

`GET /api/v1/internal/rides/:rideId/booking-info`

Expected response:

```json
{
  "rideId": "UUID-OF-RIDE",
  "driverId": "UUID-OF-DRIVER",
  "status": "PUBLISHED"
}
```

Ride Service must verify that the ride exists and return its actual owner/driver.

### B. Reserve seats

`POST /api/v1/internal/rides/:rideId/reservations`

Headers:
- `Idempotency-Key: <bookingId>`

Body:

```json
{
  "bookingId": "UUID-OF-BOOKING",
  "passengerId": "UUID-OF-PASSENGER",
  "seats": 2
}
```

Success response:

```json
{
  "success": true,
  "bookingId": "UUID-OF-BOOKING",
  "reservedSeats": 2,
  "availableSeats": 1
}
```

If insufficient seats, Ride Service should return HTTP 409.

Ride Service must atomically check and decrement available seats in its own PostgreSQL transaction. It must also store a unique reservation keyed by `bookingId`, so retrying the same request does not deduct seats twice.

### C. Release seats

`POST /api/v1/internal/rides/:rideId/reservations/:bookingId/release`

Header:
- `Idempotency-Key: release-<bookingId>`

Body:

```json
{
  "seats": 2
}
```

Ride Service must release a reservation only once. A repeated release request must not increase available seats twice.

## 6. RabbitMQ events

This service publishes events to a durable topic exchange named `booking.events`.

Suggested routing keys:
- `booking.requested`
- `booking.confirmed`
- `booking.rejected`
- `booking.cancelled`

Notification Service can bind a queue to `booking.#` to receive all booking events, or bind only to specific event keys.

Example `BookingRequested` event:

```json
{
  "eventId": "UUID-OF-OUTBOX-EVENT",
  "eventType": "BookingRequested",
  "bookingId": "UUID-OF-BOOKING",
  "rideId": "UUID-OF-RIDE",
  "passengerId": "UUID-OF-PASSENGER",
  "driverId": "UUID-OF-DRIVER",
  "requestedSeats": 2
}
```

Consumers should be idempotent because message delivery can be repeated.

## 7. Important production work still required

This is an educational starter, not a production-complete distributed workflow.

Before production:
- Add service-to-service authentication between Booking and Ride Service.
- Add RabbitMQ reconnect handling and publisher confirms with robust retry.
- Add an outbox worker claim/lease strategy for multiple Booking Service instances.
- Add reconciliation for bookings stuck in `APPROVING` after network timeouts or crashes.
- Add idempotent reservation and release implementation in Ride Service.
- Add rate limiting, structured logging, request validation and automated tests.
- Ensure cancellation and seat-release state transitions are concurrency-safe.
- Align JWT role names and IDs with your Identity Service.
