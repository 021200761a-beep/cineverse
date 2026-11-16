
import { app } from "@azure/functions";
import { getDatabase } from "./lib/database.js";
import { passwordMatches } from "./lib/auth.js";
import {
  readAdminSession,
  adminSessionCookie,
  clearAdminSessionCookie
} from "./lib/admin-auth.js";

const ALLOWED_ORIGIN =
  "https://red-bay-039d2c61e.3.azurestaticapps.net";

// ============================================
// LOGIN ADMINISTRATIVO
// POST /api/admin/login
// ============================================

app.http("admin-login", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "admin/login",

  handler: async (request, context) => {
    try {
      if (request.headers.get("origin") !== ALLOWED_ORIGIN) {
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
        typeof body.username !== "string" ||
        typeof body.password !== "string"
      ) {
        return {
          status: 400,
          jsonBody: {
            error: "Completa usuario y contraseña."
          }
        };
      }

      const username = body.username.trim();
      const password = body.password;

      if (
        !username ||
        username.length > 150 ||
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
        `SELECT
           admin_id,
           username,
           full_name,
           password_salt,
           password_hash,
           role,
           is_active
         FROM admin_users
         WHERE username = ?
         LIMIT 1`,
        [username]
      );

      const account = rows[0];

      if (
        !account ||
        Number(account.is_active) !== 1 ||
        !passwordMatches(
          password,
          account.password_salt,
          account.password_hash
        )
      ) {
        return {
          status: 401,
          jsonBody: {
            error: "Usuario o contraseña incorrectos, o cuenta desactivada."
          }
        };
      }

      const adminId = Number(account.admin_id);

      if (!Number.isSafeInteger(adminId) || adminId <= 0) {
        throw new Error("ID administrativo inválido.");
      }

      const cookie = adminSessionCookie(adminId);

      await db.execute(
        `UPDATE admin_users
         SET last_login_at = NOW()
         WHERE admin_id = ?`,
        [adminId]
      );

      return {
        status: 200,
        headers: {
          "Set-Cookie": cookie,
          "Cache-Control": "no-store"
        },
        jsonBody: {
          ok: true,
          admin: {
            id: adminId,
            username: account.username,
            name: account.full_name,
            role: account.role
          }
        }
      };

    } catch (error) {
      context.error("Error en login administrativo:", error);

      return {
        status: 503,
        jsonBody: {
          error: "No se pudo validar el acceso administrativo."
        }
      };
    }
  }
});


/**
 * ============================================
 * VERIFICAR SESIÓN ADMINISTRATIVA
 * GET /api/admin/me
 * ============================================
 */

app.http("admin-me", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "admin/me",

  handler: async (request, context) => {
    try {
      const adminId = readAdminSession(request);

      if (!adminId) {
        return {
          status: 401,
          headers: { "Cache-Control": "no-store" },
          jsonBody: {
            error: "Sesión administrativa requerida."
          }
        };
      }

      const db = getDatabase();

      const [rows] = await db.execute(
        `SELECT
           admin_id,
           username,
           full_name,
           role,
           is_active
         FROM admin_users
         WHERE admin_id = ?
         LIMIT 1`,
        [adminId]
      );

      const account = rows[0];

      if (!account || Number(account.is_active) !== 1) {
        return {
          status: 401,
          headers: { "Cache-Control": "no-store" },
          jsonBody: {
            error: "Sesión administrativa inválida."
          }
        };
      }

      return {
        status: 200,
        headers: { "Cache-Control": "no-store" },
        jsonBody: {
          admin: {
            id: Number(account.admin_id),
            username: account.username,
            name: account.full_name,
            role: account.role
          }
        }
      };

    } catch (error) {
      context.error("Error al verificar sesión administrativa:", error);

      return {
        status: 503,
        jsonBody: {
          error: "No se pudo verificar la sesión administrativa."
        }
      };
    }
  }
});


/**
 * ============================================
 * CERRAR SESIÓN ADMINISTRATIVA
 * POST /api/admin/logout
 * ============================================
 */

app.http("admin-logout", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "admin/logout",

  handler: async (request, context) => {
    try {
      const origin = request.headers.get("origin");

      if (origin !== ALLOWED_ORIGIN) {
        return {
          status: 403,
          jsonBody: {
            error: "Origen no autorizado."
          }
        };
      }

      return {
        status: 200,
        headers: {
          "Set-Cookie": clearAdminSessionCookie(),
          "Cache-Control": "no-store"
        },
        jsonBody: {
          ok: true
        }
      };

    } catch (error) {
      context.error("Error al cerrar sesión administrativa:", error);

      return {
        status: 503,
        jsonBody: {
          error: "No se pudo cerrar la sesión administrativa."
        }
      };
    }
  }
});
