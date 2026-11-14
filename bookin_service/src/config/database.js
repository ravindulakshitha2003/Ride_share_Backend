import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

// This pool connects ONLY to the Booking Service database.
export const pool = new Pool({
  connectionString: env.databaseUrl,
  // In production, configure SSL according to your database provider.
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error);
});
