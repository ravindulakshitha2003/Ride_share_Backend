import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

const env = process.env;

const pool = new Pool({
    host: env.PG_HOST || env.DB_HOST || 'localhost',
    port: Number(env.PG_PORT || env.DB_PORT || 5432),
    database: env.PG_DATABASE || env.DB_NAME || 'share_ride_db',
    user: env.PG_USER || env.DB_USER || 'postgres',
    password: String(env.PG_PASSWORD ?? env.DB_PASSWORD ?? ''),
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
});

pool.on('error', error => console.error('Unexpected PostgreSQL pool error:', error));
export default pool;