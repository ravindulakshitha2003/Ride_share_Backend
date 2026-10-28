
import jwt from "jsonwebtoken";

export function verifyToken(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Authentication token required",
    });
  }

  const token = authorization.slice(7);

  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.user = {
      id: payload.sub,
      name: payload.name,
      role: payload.role,
    };

    next();
  } catch {
    return res.status(401).json({
      message: "Invalid or expired authentication token",
    });
  }
}

export function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Forbidden",
      });
    }

    next();
  };
}
