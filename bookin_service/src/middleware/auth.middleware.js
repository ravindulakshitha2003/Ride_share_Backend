import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

// Expected JWT claims: userId (or sub) and role.
// Adjust these claim names to match the token created by your Identity Service.
export function authenticate(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authorization token is required' });
  }

  const token = authorization.slice('Bearer '.length);

  try {
    const decoded = jwt.verify(token, env.jwtSecret);

    req.user = {
      id: decoded.userId || decoded.id || decoded.sub,
      role: decoded.role
    };

    if (!req.user.id) {
      return res.status(401).json({ message: 'Token does not contain a user ID' });
    }

    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You are not allowed to perform this action' });
    }
    next();
  };
}
