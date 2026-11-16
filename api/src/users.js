
import { app } from "@azure/functions";
import { getDatabase } from "./lib/database.js";
import {
  makePassword,
  passwordMatches,
  sessionCookie,
  readSession
} from "./lib/auth.js";

app.http("user-register", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "user/register",

  handler: async (request, context) => {
    try {
      // Solo aceptar solicitudes JSON.
      const contentType = request.headers.get("content-type") || "";

      if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
        return {
          status: 415,
          jsonBody: { error: "Se requiere Content-Type: application/json." }
        };
      }

      // Comprobar el origen de las solicitudes del navegador.
      // Permitir registros únicamente desde el sitio oficial.
      const origin = request.headers.get("origin");
      const allowedOrigin = "https://red-bay-039d2c61e.3.azurestaticapps.net";

        if (origin !== allowedOrigin) {
        return {
            status: 403,
            jsonBody: {
            error: "Origen no autorizado."
            }
        };
        }

      const contentLength = Number(
         request.headers.get("content-length") || 0
        );

        if (contentLength > 8192) {
        return {
            status: 413,
            jsonBody: {
            error: "La solicitud supera el tamaño permitido."
            }
        };
        }

        const rawBody = await request.text();

        if (Buffer.byteLength(rawBody, "utf8") > 8192) {
        return {
            status: 413,
            jsonBody: {
            error: "La solicitud supera el tamaño permitido."
            }
        };
        }

        let body;

        try {
        body = JSON.parse(rawBody);
        } catch {
        return {
            status: 400,
            jsonBody: {
            error: "Datos JSON inválidos."
            }
        };
        }

      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return {
          status: 400,
          jsonBody: { error: "Datos JSON inválidos." }
        };
      }

      if (
        typeof body.name !== "string" ||
        typeof body.email !== "string" ||
        typeof body.password !== "string"
      ) {
        return {
          status: 400,
          jsonBody: { error: "Nombre, correo y contraseña son obligatorios." }
        };
      }

      const name = body.name.trim();
      const email = body.email.trim().toLowerCase();
      const password = body.password;

      if (name.length < 2 || name.length > 100) {
        return {
          status: 400,
          jsonBody: { error: "El nombre debe tener entre 2 y 100 caracteres." }
        };
      }

      if (
        email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ) {
        return {
          status: 400,
          jsonBody: { error: "Correo electrónico inválido." }
        };
      }

      if (password.length < 8 || password.length > 1024) {
        return {
          status: 400,
          jsonBody: { error: "La contraseña debe tener entre 8 y 1024 caracteres." }
        };
      }

      const db = getDatabase();

      const [existing] = await db.execute(
        "SELECT user_id FROM user_accounts WHERE email = ? LIMIT 1",
        [email]
      );

      if (existing.length) {
        return {
          status: 409,
          jsonBody: { error: "Ya existe una cuenta con ese correo electrónico." }
        };
      }

      const { salt, hash } = makePassword(password);

      const [result] = await db.execute(
        `INSERT INTO user_accounts
         (display_name, email, password_salt, password_hash, is_blocked)
         VALUES (?, ?, ?, ?, 0)`,
        [name, email, salt, hash]
      );

      const userId = Number(result.insertId);

            if (!Number.isSafeInteger(userId) || userId <= 0) {
            context.error("TiDB devolvió un ID de usuario inválido.");

            return {
                status: 503,
                jsonBody: {
                error: "No se pudo completar el registro."
                }
            };
         }

      const user = {
            id: userId,
            name,
            email
        };

      return {
        status: 201,
        headers: {
          "Set-Cookie": sessionCookie(user.id),
          "Cache-Control": "no-store"
        },
        jsonBody: {
          ok: true,
          user
        }
      };

    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") {
        return {
          status: 409,
          jsonBody: { error: "Ya existe una cuenta con ese correo electrónico." }
        };
      }

      context.error("Error registrando usuario:", error);

      return {
        status: 503,
        jsonBody: {
          error: "No se pudo crear la cuenta. Inténtalo nuevamente."
        }
      };
    }
  }
});


// ============================================
// INICIO DE SESIÓN DE USUARIOS
// POST /api/user/login
// ============================================

app.http("user-login", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "user/login",

  handler: async (request, context) => {
    try {
      const allowedOrigin =
        "https://red-bay-039d2c61e.3.azurestaticapps.net";

      if (request.headers.get("origin") !== allowedOrigin) {
        return {
          status: 403,
          jsonBody: { error: "Origen no autorizado." }
        };
      }

      const contentType = request.headers.get("content-type") || "";

      if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
        return {
          status: 415,
          jsonBody: { error: "Se requiere JSON." }
        };
      }

      const rawBody = await request.text();

      if (Buffer.byteLength(rawBody, "utf8") > 8192) {
        return {
          status: 413,
          jsonBody: { error: "Solicitud demasiado grande." }
        };
      }

      let body;

      try {
        body = JSON.parse(rawBody);
      } catch {
        return {
          status: 400,
          jsonBody: { error: "JSON inválido." }
        };
      }

      if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body) ||
        typeof body.email !== "string" ||
        typeof body.password !== "string"
      ) {
        return {
          status: 400,
          jsonBody: { error: "Correo y contraseña obligatorios." }
        };
      }

      const email = body.email.trim().toLowerCase();
      const password = body.password;

      if (
        !email ||
        email.length > 254 ||
        !password ||
        password.length > 1024
      ) {
        return {
          status: 400,
          jsonBody: { error: "Datos de acceso inválidos." }
        };
      }

      const db = getDatabase();

      const [rows] = await db.execute(
        `SELECT user_id, display_name, email,
                password_salt, password_hash, is_blocked
         FROM user_accounts
         WHERE email = ?
         LIMIT 1`,
        [email]
      );

      const account = rows[0];

      if (
        !account ||
        !passwordMatches(
          password,
          account.password_salt,
          account.password_hash
        )
      ) {
        return {
          status: 401,
          jsonBody: {
            error: "Correo o contraseña incorrectos."
          }
        };
      }

      if (Number(account.is_blocked) === 1) {
        return {
          status: 403,
          jsonBody: { error: "Cuenta bloqueada." }
        };
      }

      const userId = Number(account.user_id);

      if (!Number.isSafeInteger(userId) || userId <= 0) {
        throw new Error("ID de usuario inválido.");
      }

      const user = {
        id: userId,
        name: account.display_name,
        email: account.email
      };

      return {
        status: 200,
        headers: {
          "Set-Cookie": sessionCookie(user.id),
          "Cache-Control": "no-store"
        },
        jsonBody: {
          ok: true,
          user
        }
      };

    } catch (error) {
      context.error("Error iniciando sesión:", error);

      return {
        status: 503,
        jsonBody: {
          error: "No se pudo iniciar sesión."
        }
      };
    }
  }
});

// ============================================
// OBTENER USUARIO CON SESIÓN ACTIVA
// GET /api/user/me
// ============================================

app.http("user-me", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "user/me",

  handler: async (request, context) => {
    try {
      // Leer y verificar la cookie de sesión.
      const userId = readSession(request);

      // Sin sesión o con cookie inválida.
      if (!userId) {
        return {
          status: 200,
          headers: {
            "Cache-Control": "no-store"
          },
          jsonBody: {
            user: null
          }
        };
      }

      // Consultar el usuario en TiDB Cloud.
      const db = getDatabase();

      const [rows] = await db.execute(
        `SELECT user_id, display_name, email, is_blocked
         FROM user_accounts
         WHERE user_id = ?
         LIMIT 1`,
        [userId]
      );

      const account = rows[0];

      // Usuario inexistente o bloqueado.
      if (!account || Number(account.is_blocked) === 1) {
        return {
          status: 200,
          headers: {
            "Cache-Control": "no-store"
          },
          jsonBody: {
            user: null
          }
        };
      }

      // Respuesta compatible con el frontend.
      return {
        status: 200,
        headers: {
          "Cache-Control": "no-store"
        },
        jsonBody: {
          user: {
            id: Number(account.user_id),
            name: account.display_name,
            email: account.email
          }
        }
      };

    } catch (error) {
      context.error("Error verificando sesión:", error);

      return {
        status: 503,
        headers: {
          "Cache-Control": "no-store"
        },
        jsonBody: {
          error: "No se pudo verificar la sesión."
        }
      };
    }
  }
});