-- CineVerse: migración de cuentas de usuario para MySQL/MariaDB (XAMPP)
-- Ejecutar una sola vez en phpMyAdmin > cineversedb > SQL.
-- No elimina usuarios ni administradores existentes.
ALTER TABLE user_accounts
  ADD COLUMN IF NOT EXISTS password_salt VARCHAR(128) NULL AFTER email,
  ADD COLUMN IF NOT EXISTS password_hash VARCHAR(256) NULL AFTER password_salt;

-- Comprueba la estructura después de ejecutar:
-- DESCRIBE user_accounts;
