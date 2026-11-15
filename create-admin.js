import mysql from "mysql2/promise";
import crypto from "node:crypto";
import "dotenv/config";

const args = Object.fromEntries(process.argv.slice(2).map(x => {
  const [k, ...v] = x.replace(/^--/, "").split("=");
  return [k, v.join("=")];
}));
const username = args.username || "admin";
const password = args.password;
const name = args.name || "Administrador CineVerse";
const email = args.email || "admin@cineverse.local";

if (!password || password.length < 12) {
  console.error("Indica --password=... con al menos 12 caracteres.");
  process.exit(1);
}

const salt = crypto.randomBytes(32).toString("hex");
const hash = crypto.scryptSync(password, salt, 64).toString("hex");
const db = await mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "cineversedb",
  charset: "utf8mb4"
});

try {
  const [existing] = await db.execute("SELECT admin_id FROM admin_users WHERE username = ? LIMIT 1", [username]);
  if (existing.length) throw new Error(`El usuario "${username}" ya existe. No se modificó.`);
  await db.execute(
    `INSERT INTO admin_users
      (username, full_name, email, password_salt, password_hash, role, is_active)
     VALUES (?, ?, ?, ?, ?, 'SuperAdmin', 1)`,
    [username, name, email, salt, hash]
  );
  console.log(`Administrador "${username}" creado en MySQL.`);
} finally {
  await db.end();
}
