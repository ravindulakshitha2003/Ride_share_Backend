//This code loads environment variables from the .env file and checks 
// whether all required variables (database credentials and JWT secret) are 
// provided. It then exports the application port, JWT secret, and PostgreSQL 
// database configuration for use in other files.

require('dotenv').config();

const required = ['PG_HOST', 'PG_PORT', 'PG_USER', 'PG_PASSWORD', 'PG_DATABASE', 'JWT_SECRET'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  throw new Error(`Missing environment variables: ${missing.join(', ')}`);
}

module.exports = {
  port: process.env.PORT || 5002,
  jwtSecret: process.env.JWT_SECRET,
  db: {
    host: process.env.PG_HOST,
    port: Number(process.env.PG_PORT),
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE,
  },
};