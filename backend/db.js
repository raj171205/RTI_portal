import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
  : new Pool({
      user: process.env.DB_USER || "rajpatel",
      host: process.env.DB_HOST || "localhost",
      database: process.env.DB_NAME || "rti_db",
      password: process.env.DB_PASSWORD || "",
      port: Number(process.env.DB_PORT) || 5433,
    });

export default pool;
