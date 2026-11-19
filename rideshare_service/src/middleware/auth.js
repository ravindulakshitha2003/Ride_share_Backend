/*This code implements JWT authentication middleware. It checks the request for a valid
 Bearer token, verifies the token using the JWT secret, and attaches the authenticated 
 user's ID to req.user. If the token is missing, invalid, or expired, it returns a 401 authentication error.
*/
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/env');
const AppError = require('../utils/AppError');

module.exports = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new AppError('Authentication required', 401));

  try {
    const payload = jwt.verify(token, jwtSecret);
    // Adjust to match the payload made by authentication_service
    req.user = { id: String(payload.id || payload.userId || payload.sub || payload._id) };
    next();
  } catch {
    next(new AppError('Invalid or expired token', 401));
  }
};