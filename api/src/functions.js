
import { app } from "@azure/functions";

import { testDatabaseConnection } from './lib/database.js';

import "./users.js";

import "./trailers.js";

app.http("status", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "status",

  handler: async () => {
    return {
      jsonBody: {
        tmdb: Boolean(process.env.TMDB_API_KEY),
        youtube: Boolean(process.env.YOUTUBE_API_KEY),
        omdb: Boolean(process.env.OMDB_API_KEY),
        unsplash: Boolean(process.env.UNSPLASH_ACCESS_KEY),
        anilist: true,
        jikan: true
      }
    };
  }
});

app.http("discover", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "discover",

  handler: async (request) => {
    const key = process.env.TMDB_API_KEY;

    if (!key) {
      return {
        status: 503,
        jsonBody: { error: "TMDB no configurada" }
      };
    }

    const kind = request.query.get("kind") || "movie";
    const category = request.query.get("category") || "trending";
    const page = Math.max(
      1,
      Math.min(100, Number(request.query.get("page")) || 1)
    );

    const type = kind === "tv" ? "tv" : "movie";

    const routes = {
      trending: `/trending/${type}/week`,
      popular: `/${type}/popular`,
      top_rated: `/${type}/top_rated`,
      upcoming: type === "movie"
        ? "/movie/upcoming"
        : "/tv/on_the_air"
    };

    const path = routes[category] || routes.trending;

    try {
      const url = new URL(
        `https://api.themoviedb.org/3${path}`
      );

      url.searchParams.set("api_key", key);
      url.searchParams.set("language", "es-ES");
      url.searchParams.set("page", String(page));

      const response = await fetch(url);

      if (!response.ok) {
        return {
          status: 502,
          jsonBody: { error: "Error al consultar TMDB" }
        };
      }

      const data = await response.json();

      const results = (data.results || []).map(item => ({
        id: `${type}-${item.id}`,
        sourceId: item.id,
        source: "tmdb",
        type,
        title: item.title || item.name || "Sin título",
        overview: item.overview || "",
        poster: item.poster_path
          ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
          : "",
        backdrop: item.backdrop_path
          ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}`
          : "",
        year: (
          item.release_date ||
          item.first_air_date ||
          ""
        ).slice(0, 4),
        rating: item.vote_average
          ? Number(item.vote_average).toFixed(1)
          : "—",
        genres: [],
        language: item.original_language || "",
        popularity: item.popularity || 0
      }));

      return {
        jsonBody: {
          results,
          page: data.page,
          totalPages: data.total_pages
        }
      };

    } catch {
      return {
        status: 502,
        jsonBody: {
          error: "No se pudo conectar con TMDB"
        }
      };
    }
  }
});



app.http('db-status', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'db-status',

  handler: async (request, context) => {
    try {
      const result = await testDatabaseConnection();

      return {
        status: 200,
        jsonBody: {
          success: true,
          database: result.database_name,
          connected: true
        }
      };
    } catch (error) {
      context.error('Error de conexión a TiDB:', error);

      const allowedCodes = [
        'ETIMEDOUT',
        'ECONNREFUSED',
        'ENOTFOUND',
        'ER_ACCESS_DENIED_ERROR',
        'HANDSHAKE_SSL_ERROR',
        'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
        'SELF_SIGNED_CERT_IN_CHAIN',
        'CERT_HAS_EXPIRED'
      ];

      const code = allowedCodes.includes(error.code)
        ? error.code
        : 'UNKNOWN_ERROR';

      return {
        status: 503,
        jsonBody: {
          success: false,
          errorCode: code,
          message: 'No se pudo conectar a TiDB'
        }
      };
    }
  }
});
