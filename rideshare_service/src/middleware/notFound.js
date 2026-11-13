/*
This code handles requests to routes that do not exist in the application. 
It returns a 404 Not Found error with the requested HTTP method and URL.
*/

const AppError = require('../utils/AppError');
module.exports = (req, res, next) => next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));