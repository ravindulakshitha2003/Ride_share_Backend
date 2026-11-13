//This code automatically runs pending SQL migration files to create or update 
// the database structure. It tracks already-applied migrations to avoid 
// running them again and uses transactions to ensure changes are safely applied.

const fs = require('fs');
const path = require('path');
const pool = require('./pool');

(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);

  const dir = path.join(__dirname, '..', '..', 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const { rows } = await pool.query('SELECT filename FROM schema_migrations');
  const done = new Set(rows.map((r) => r.filename));

  for (const file of files) {
    if (done.has(file)) {
      console.log(`Skipped  ${file} (already applied)`);
      continue;
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(fs.readFileSync(path.join(dir, file), 'utf8'));
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`Applied  ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
  await pool.end();
  console.log('Migrations complete');
})().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});