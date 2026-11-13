import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),

    database: process.env.DB_NAME,

    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,

    max: 10,

    idleTimeoutMillis: 30000,

    connectionTimeoutMillis: 5000
});

pool.on("connect", () => {
    console.log("PostgreSQL client connected");
});

pool.on("error", (error) => {
    console.error("PostgreSQL pool error:", error);
});

export async function testDatabaseConnection() {

    const result = await pool.query(
        "SELECT PostGIS_Version() AS postgis_version"
    );

    console.log(
        "PostGIS connected:",
        result.rows[0].postgis_version
    );
}

export default pool;