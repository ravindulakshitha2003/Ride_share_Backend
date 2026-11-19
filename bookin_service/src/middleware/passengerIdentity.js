// TEMPORARY DEVELOPMENT MIDDLEWARE.
// Replace this with your project's JWT/auth middleware.
// The passenger ID is deliberately not accepted in the booking body.
export function passengerIdentity(req, res, next) {
  const passengerId = req.header('x-passenger-id');

  if (!passengerId) {
    return res.status(401).json({
      success: false,
      message: 'Missing x-passenger-id header (temporary development auth).',
    });
  }

  req.user = { id: passengerId };
  next();
}
