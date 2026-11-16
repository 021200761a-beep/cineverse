
import { app } from "@azure/functions";
import { readSession } from "./lib/auth.js";
import { getDatabase } from "./lib/database.js";

app.http("trailer-search", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "trailer",

  handler: async (request, context) => {
    try {
      // Verificar la sesión del usuario.
      const userId = readSession(request);

      if (!userId) {
        return {
          status: 401,
          jsonBody: { error: "Debes iniciar sesión." }
        };
      }

      // Comprobar que la cuenta existe y está activa.
      const db = getDatabase();

      const [rows] = await db.execute(
        `SELECT user_id FROM user_accounts
         WHERE user_id = ? AND is_blocked = 0
         LIMIT 1`,
        [userId]
      );

      if (!rows.length) {
        return {
          status: 401,
          jsonBody: { error: "Sesión no válida." }
        };
      }

      const q = (request.query.get("q") || "").trim();

      if (!q) {
        return {
          status: 200,
          jsonBody: { results: [] }
        };
      }

      if (q.length > 200) {
        return {
          status: 400,
          jsonBody: { error: "Búsqueda demasiado larga." }
        };
      }

      const apiKey = process.env.YOUTUBE_API_KEY;

      if (!apiKey) {
        return {
          status: 503,
          jsonBody: {
            error: "YouTube Data API no está configurada."
          }
        };
      }

      const url = new URL(
        "https://www.googleapis.com/youtube/v3/search"
      );

      url.searchParams.set("part", "snippet");
      url.searchParams.set("type", "video");
      url.searchParams.set("maxResults", "8");
      url.searchParams.set("q", `${q} official trailer`);
      url.searchParams.set("key", apiKey);

      const response = await fetch(url, {
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        context.warn("YouTube API respondió:", response.status);

        return {
          status: 502,
          jsonBody: {
            error: "No se pudieron obtener los tráileres."
          }
        };
      }

      const data = await response.json();

      return {
        status: 200,
        headers: {
          "Cache-Control": "private, no-store"
        },
        jsonBody: {
          results: (data.items || []).map(item => ({
            id: item.id?.videoId,
            title: item.snippet?.title,
            channel: item.snippet?.channelTitle,
            thumbnail: item.snippet?.thumbnails?.high?.url
          })).filter(item => item.id)
        }
      };

    } catch (error) {
      context.error("Error consultando tráileres:", error);

      return {
        status: 502,
        jsonBody: {
          error: "No se pudo completar la búsqueda de tráileres."
        }
      };
    }
  }
});
