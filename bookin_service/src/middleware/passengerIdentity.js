// TEMPORARY DEVELOPMENT MIDDLEWARE.
// Replace this with your project's JWT/auth middleware.
// The passenger ID is deliberately not accepted in the booking body.
export function passengerIdentity(req, res, next) {
  let passengerId = req.header('x-passenger-id') || req.header('x-user-id');

  if (!passengerId && req.headers.authorization) {
    try {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
        const payload = JSON.parse(Buffer.from(parts[1].split('.')[1], 'base64').toString('utf8'));
        passengerId = payload.sub || payload.id || payload.userId;
      }
    } catch (e) {
      // ignore token parse error
    }
  }

  if (!passengerId) {
    return res.status(401).json({
      success: false,
      message: 'Missing x-passenger-id or Authorization header.',
    });
  }

  req.user = { id: passengerId, role: 'PASSENGER' };
  next();
}
