//This code creates a PostgreSQL connection pool using the database configuration 
// from the environment settings. 
// It exports the pool so other files can reuse database connections efficiently.

const { Pool } = require('pg');
const { db } = require('../config/env');

module.exports = new Pool(db);