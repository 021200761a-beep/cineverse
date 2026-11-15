import crypto from "node:crypto";

const usuario = "admin";
const nombre = "Administrador CineVerse";
const correo = "admin@cineverse.local";
const contraseña = "CineVerse2026Seguro!";

const salt = crypto.randomBytes(32).toString("hex");
const hash = crypto.scryptSync(contraseña, salt, 64).toString("hex");

console.log(`
INSERT INTO admin_users
(username, full_name, email, password_salt, password_hash, role, is_active)
VALUES (
  '${usuario}',
  '${nombre}',
  '${correo}',
  '${salt}',
  '${hash}',
  'SuperAdmin',
  1
);
`);