/*
This code creates an asyncHandler wrapper that automatically catches errors from 
asynchronous route handlers and passes them to Express's error-handling middleware.
*/

module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);