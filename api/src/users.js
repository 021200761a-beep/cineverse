
import { app } from "@azure/functions";
import { getDatabase } from "./lib/database.js";
import { makePassword, sessionCookie } from "./lib/auth.js";

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
      const origin = request.headers.get("origin");
      const expectedOrigin = new URL(request.url).origin;

      if (origin && origin !== expectedOrigin) {
        return {
          status: 403,
          jsonBody: { error: "Origen no autorizado." }
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

      const user = {
        id: result.insertId,
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
