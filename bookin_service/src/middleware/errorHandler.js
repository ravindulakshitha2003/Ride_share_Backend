export function errorHandler(error, req, res, next) {
  // Expected errors (HttpError with a status, e.g. 404/409) get one short line.
  // Unexpected errors (bugs, DB down) get the full stack trace.
  if (error.status && error.status < 500) {
    console.warn(`${req.method} ${req.originalUrl} -> ${error.status} ${error.message}`);
  } else {
    console.error(error);
  }

  if (res.headersSent) {
    return next(error);
  }

  // ---- Added for booking lifecycle ----------------------------------------
  // PostgreSQL error 23505 = unique constraint violated. With migration 004
  // that means "this passenger already has an active booking for this ride".
  // Return 409 Conflict instead of a confusing 500.
  if (error.code === '23505') {
    return res.status(409).json({
      success: false,
      code: 'DUPLICATE_ACTIVE_BOOKING',
      message: 'You already have an active booking for this ride.',
    });
  }

  // PostgreSQL error 22P02 = "invalid input syntax", e.g. a non-UUID value
  // sent for a UUID column (driver_id / passenger_id). That's bad input from
  // the caller -> 400, not a server crash (500).
  if (error.code === '22P02') {
    return res.status(400).json({
      success: false,
      code: 'INVALID_ID_FORMAT',
      message: 'One of the ids has an invalid format (expected a UUID).',
    });
  }

  // Malformed JSON body (e.g. missing quote) -> 400 instead of 500.
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Request body is not valid JSON' });
  }
  // -------------------------------------------------------------------------

  return res.status(error.status || 500).json({
    success: false,
    message: error.status ? error.message : 'Internal server error',
    // Only HttpError sets these; undefined fields are left out of the JSON.
    code: error.status ? error.code : undefined,
    errors: error.status ? error.errors : undefined,
  });
}
