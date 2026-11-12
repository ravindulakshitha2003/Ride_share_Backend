/*
This code implements centralized error-handling middleware for Express. 
It determines the appropriate HTTP status code and sends a consistent JSON error 
response, including validation details when available.
*/

module.exports = (err, req, res, next) => {
  const status = err.statusCode || 500;
  if (status === 500) console.error(err);
  res.status(status).json({
    message: status === 500 ? 'Internal server error' : err.message,
    ...(err.details && { errors: err.details }),
  });
};