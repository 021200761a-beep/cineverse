-- Ejecutar UNA SOLA VEZ en phpMyAdmin sobre la base cineversedb.
-- Agrega autenticación por correo y contraseña a las cuentas de usuarios.
ALTER TABLE user_accounts
  ADD COLUMN password_salt VARCHAR(64) NULL AFTER email,
  ADD COLUMN password_hash CHAR(128) NULL AFTER password_salt,
  ADD UNIQUE KEY uq_user_accounts_email (email);

-- Las cuentas creadas desde CineVerse guardarán salt/hash automáticamente.
-- Las cuentas antiguas sin contraseña podrán registrarse con otro correo,
-- o deberán restablecerse desde el proceso de administración correspondiente.
