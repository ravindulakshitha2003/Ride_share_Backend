import dotenv from 'dotenv';
import app from './app.js';
import { pool } from './config/db.js';

dotenv.config();

const PORT = process.env.PORT || 5001;

async function startServer() {
  try {
    await pool.query('SELECT 1');
    console.log('PostgreSQL connection successful');

    app.listen(PORT, () => {
      console.log(`Booking Service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start Booking Service:', error);
    process.exit(1);
  }
}

startServer();
