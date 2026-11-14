// Central error handler. Route handlers pass unexpected errors to next(error).
export function errorHandler(error, req, res, next) {
  console.error(error);

  if (res.headersSent) return next(error);

  const status = error.status || 500;
  res.status(status).json({
    message: status === 500 ? 'Internal server error' : error.message
  });
}
