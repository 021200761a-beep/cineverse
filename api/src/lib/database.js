
import mysql from 'mysql2/promise';

let pool;

export function getDatabase() {
  if (!pool) {
    const required = [
      'DB_HOST',
      'DB_PORT',
      'DB_USER',
      'DB_PASSWORD',
      'DB_NAME',
      'DB_SSL_CA'
    ];

    for (const key of required) {
      if (!process.env[key]) {
        throw new Error(`Falta configurar ${key}`);
      }
    }

    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: {
        ca: process.env.DB_SSL_CA.replace(/\\n/g, '\n'),
        rejectUnauthorized: true
      },
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      connectTimeout: 15000
    });
  }

  return pool;
}

export async function testDatabaseConnection() {
  const db = getDatabase();

  const [rows] = await db.query(
    'SELECT DATABASE() AS database_name, 1 AS connected'
  );

  return rows[0];
}
