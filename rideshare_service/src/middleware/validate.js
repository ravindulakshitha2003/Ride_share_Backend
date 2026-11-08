/*
This code creates validation middleware that checks request data (body, query, or params) 
against a provided schema. If validation fails, it returns a 400 error with details; 
otherwise, it passes the validated data to the next middleware.
*/

const AppError = require('../utils/AppError');

// source: 'body' | 'query' | 'params'
module.exports = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    return next(new AppError('Validation failed', 400, details));
  }
  req[source] = result.data;
  next();
};