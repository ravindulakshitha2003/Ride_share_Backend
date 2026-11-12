/*
This code defines a custom AppError class to handle application errors with a message, 
HTTP status code, and optional additional details. It helps manage errors consistently 
across the backend.
*/

class AppError extends Error {
  constructor(message, statusCode = 500, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}
module.exports = AppError;