import express from "express";
import mysql from "mysql2/promise";
import crypto from "node:crypto";
import session from "express-session";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.json());
app.use(session({
  name: "cineverse.sid",
  secret: process.env.SESSION_SECRET || "cambiar-esta-clave-larga-en-produccion",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 7 * 24 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname, "public")));

function userOnly(req, res, next) {
  if (req.session?.user) return next();
  return res.status(401).json({ error: "Inicia sesión con tu cuenta CineVerse para utilizar esta función.", code: "LOGIN_REQUIRED" });
}

const cache = new Map();
async function fetchJson(url, options = {}) {
  const key = `${url}|${options.method || "GET"}|${options.body || ""}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.time < 3 * 60 * 1000) return cached.data;
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`API respondió ${response.status}. ${body.slice(0, 180)}`);
  }
  const data = await response.json();
  cache.set(key, { time: Date.now(), data });
  return data;
}
function missingKey(name) {
  return !process.env[name] || process.env[name].trim() === "";
}
function tmdbImage(path, size = "w500") {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : "";
}
function normaliseTmdb(item, type = "movie") {
  return {
    id: `${type}-${item.id}`,
    sourceId: item.id,
    source: "tmdb",
    type,
    title: item.title || item.name || "Sin título",
    overview: item.overview || "No hay sinopsis disponible en español.",
    poster: tmdbImage(item.poster_path),
    backdrop: tmdbImage(item.backdrop_path, "w1280"),
    year: (item.release_date || item.first_air_date || "").slice(0, 4),
    rating: item.vote_average ? Number(item.vote_average).toFixed(1) : "—",
    genres: (item.genre_ids || []).map(id => TMDB_GENRES[id]).filter(Boolean),
    language: item.original_language || "",
    popularity: item.popularity || 0
  };
}
const TMDB_GENRES = {
  28:"Acción",12:"Aventura",16:"Animación",35:"Comedia",80:"Crimen",99:"Documental",
  18:"Drama",10751:"Familia",14:"Fantasía",36:"Historia",27:"Terror",10402:"Música",
  9648:"Misterio",10749:"Romance",878:"Ciencia ficción",10770:"Película de TV",
  53:"Suspenso",10752:"Bélica",37:"Western",10759:"Acción y aventura",10762:"Infantil",
  10763:"Noticias",10764:"Reality",10765:"Ciencia ficción y fantasía",10766:"Telenovela",
  10767:"Talk show",10768:"Guerra y política"
};

app.get("/api/status", (req, res) => res.json({
  tmdb: !missingKey("TMDB_API_KEY"),
  unsplash: !missingKey("UNSPLASH_ACCESS_KEY"),
  youtube: !missingKey("YOUTUBE_API_KEY"),
  omdb: !missingKey("OMDB_API_KEY"),
  anilist: true,
  jikan: true
}));

app.get("/api/discover", async (req, res) => {
  const kind = req.query.kind || "movie";
  const category = req.query.category || "trending";
  const page = Math.max(1, Number(req.query.page) || 1);
  if (kind === "anime") {
    try {
      const data = await fetchJson("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ query: `query ($page:Int,$perPage:Int) {
          Page(page:$page,perPage:$perPage) { media(type:ANIME,sort:${category === "top_rated" ? "SCORE_DESC" : "TRENDING_DESC"},isAdult:false) {
            id title { romaji english } description(asHtml:false) episodes averageScore seasonYear genres coverImage { extraLarge large } bannerImage siteUrl
          } } }`, variables: { page, perPage: 20 } })
      });
      return res.json({ results: await applyContentOverrides((data.data?.Page?.media || []).map(a => ({
        id:`anime-${a.id}`, sourceId:a.id, source:"anilist", type:"anime",
        title:a.title.english || a.title.romaji, overview:(a.description || "").replace(/<[^>]+>/g,""),
        poster:a.coverImage?.extraLarge || a.coverImage?.large || "", backdrop:a.bannerImage || "",
        year:a.seasonYear || "", rating:a.averageScore ? (a.averageScore/10).toFixed(1) : "—",
        genres:a.genres || [], episodes:a.episodes, url:a.siteUrl
      }))) });
    } catch (e) { return res.status(502).json({ error: `AniList: ${e.message}` }); }
  }
  if (missingKey("TMDB_API_KEY")) return res.status(503).json({ error: "Falta TMDB_API_KEY. Copia .env.example a .env y agrega tu clave de TMDB." });
  const mediaType = kind === "tv" ? "tv" : "movie";
  const routes = {
    trending: `/trending/${mediaType}/week`,
    popular: `/${mediaType}/popular`,
    top_rated: `/${mediaType}/top_rated`,
    upcoming: mediaType === "movie" ? "/movie/upcoming" : "/tv/on_the_air",
    now_playing: mediaType === "movie" ? "/movie/now_playing" : "/tv/airing_today"
  };
  const route = routes[category] || routes.trending;
  try {
    const data = await fetchJson(`https://api.themoviedb.org/3${route}?language=es-ES&page=${page}&api_key=${process.env.TMDB_API_KEY}`);
    res.json({ results: await applyContentOverrides((data.results || []).map(item => normaliseTmdb(item, mediaType))), page: data.page, totalPages: data.total_pages });
  } catch (e) { res.status(502).json({ error: `TMDB: ${e.message}` }); }
});

app.get("/api/search", userOnly, async (req, res) => {
  const q = String(req.query.q || "").trim();
  const kind = req.query.kind || "all";
  if (!q) return res.json({ results: [] });
  const results = [];
  const jobs = [];
  if (kind === "all" || kind === "movie" || kind === "tv") {
    if (!missingKey("TMDB_API_KEY")) {
      const types = kind === "all" ? ["movie", "tv"] : [kind];
      for (const type of types) jobs.push((async () => {
        const data = await fetchJson(`https://api.themoviedb.org/3/search/${type}?query=${encodeURIComponent(q)}&include_adult=false&language=es-ES&page=1&api_key=${process.env.TMDB_API_KEY}`);
        results.push(...(data.results || []).map(x => normaliseTmdb(x, type)));
      })());
    }
  }
  if (kind === "all" || kind === "anime") {
    jobs.push((async () => {
      const data = await fetchJson("https://graphql.anilist.co", {
        method:"POST", headers:{"Content-Type":"application/json","Accept":"application/json"},
        body:JSON.stringify({ query:`query ($search:String) { Media(search:$search,type:ANIME,isAdult:false) {
          id title { romaji english } description(asHtml:false) episodes averageScore seasonYear genres coverImage { extraLarge large } bannerImage siteUrl
        } }`, variables:{search:q} })
      });
      const a = data.data?.Media;
      if (a) results.push({ id:`anime-${a.id}`, sourceId:a.id, source:"anilist", type:"anime",
        title:a.title.english || a.title.romaji, overview:(a.description || "").replace(/<[^>]+>/g,""),
        poster:a.coverImage?.extraLarge || a.coverImage?.large || "", backdrop:a.bannerImage || "",
        year:a.seasonYear || "", rating:a.averageScore ? (a.averageScore/10).toFixed(1) : "—",
        genres:a.genres || [], episodes:a.episodes, url:a.siteUrl });
      // Search multiple anime through Jikan for richer results
      const j = await fetchJson(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(q)}&limit=10`);
      results.push(...(j.data || []).map(a => ({ id:`jikan-${a.mal_id}`, sourceId:a.mal_id, source:"jikan", type:"anime",
        title:a.title, overview:a.synopsis || "", poster:a.images?.jpg?.large_image_url || a.images?.jpg?.image_url || "",
        backdrop:"", year:a.year || "", rating:a.score || "—", genres:(a.genres || []).map(g=>g.name),
        episodes:a.episodes, url:a.url })));
    })());
  }
  try {
    await Promise.allSettled(jobs);
    const unique = [...new Map(results.map(r => [r.id, r])).values()];
    res.json({ results: await applyContentOverrides(unique) });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.get("/api/details/:type/:id", userOnly, async (req, res) => {
  const { type, id } = req.params;
  if (type === "anime" || type === "jikan") {
    try {
      if (String(id).startsWith("jikan-") || type === "jikan") {
        const realId = String(id).replace("jikan-", "");
        const d = await fetchJson(`https://api.jikan.moe/v4/anime/${realId}/full`);
        return res.json({ ...d.data, source:"jikan", type:"anime", title:d.data.title,
          poster:d.data.images?.jpg?.large_image_url, overview:d.data.synopsis, url:d.data.url });
      }
      const d = await fetchJson("https://graphql.anilist.co", {
        method:"POST", headers:{"Content-Type":"application/json","Accept":"application/json"},
        body:JSON.stringify({query:`query ($id:Int) { Media(id:$id,type:ANIME) {
          id title { romaji english native } description(asHtml:false) episodes duration status season seasonYear averageScore genres studios(isMain:true) { nodes { name } }
          coverImage { extraLarge } bannerImage siteUrl characters(sort:ROLE,perPage:10) { nodes { name { full } image { large } } }
        } }`,variables:{id:Number(id)}})
      });
      const a=d.data?.Media;
      if (!a) return res.status(404).json({error:"Anime no encontrado"});
      return res.json({ ...a, source:"anilist", type:"anime", title:a.title.english || a.title.romaji,
        poster:a.coverImage?.extraLarge, overview:a.description, url:a.siteUrl });
    } catch(e) { return res.status(502).json({error:e.message}); }
  }
  if (missingKey("TMDB_API_KEY")) return res.status(503).json({error:"Configura TMDB_API_KEY en .env"});
  try {
    const mediaType = type === "tv" ? "tv" : "movie";
    const d = await fetchJson(`https://api.themoviedb.org/3/${mediaType}/${id}?append_to_response=credits,videos,watch/providers&language=es-ES&api_key=${process.env.TMDB_API_KEY}`);
    const providers = await fetchJson(`https://api.themoviedb.org/3/${mediaType}/${id}/watch/providers?api_key=${process.env.TMDB_API_KEY}`);
    const videos = d.videos?.results || [];
    res.json({ ...normaliseTmdb(d, mediaType), runtime:d.runtime, episode_run_time:d.episode_run_time,
      status:d.status, tagline:d.tagline, genres:d.genres?.map(g=>g.name) || [],
      cast:(d.credits?.cast || []).slice(0,12).map(c=>({name:c.name,character:c.character,photo:tmdbImage(c.profile_path,"w185")})),
      videos:videos.filter(v=>v.site==="YouTube").slice(0,10).map(v=>({name:v.name,key:v.key,type:v.type})),
      providers:providers.results?.PE ? {
        link:providers.results.PE.link,
        flatrate:providers.results.PE.flatrate || [],
        rent:providers.results.PE.rent || [],
        buy:providers.results.PE.buy || []
      } : null
    });
  } catch(e) { res.status(502).json({error:e.message}); }
});

app.get("/api/trailer", userOnly, async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json({ results:[] });
  if (missingKey("YOUTUBE_API_KEY")) return res.status(503).json({error:"Configura YOUTUBE_API_KEY en .env para activar la búsqueda de tráileres."});
  try {
    const data = await fetchJson(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=8&q=${encodeURIComponent(q+" official trailer")}&key=${process.env.YOUTUBE_API_KEY}`);
    res.json({results:(data.items || []).map(v=>({id:v.id.videoId,title:v.snippet.title,channel:v.snippet.channelTitle,thumbnail:v.snippet.thumbnails?.high?.url}))});
  } catch(e) { res.status(502).json({error:e.message}); }
});

app.get("/api/omdb", userOnly, async (req,res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json({results:[]});
  if (missingKey("OMDB_API_KEY")) return res.status(503).json({error:"Configura OMDB_API_KEY en .env para activar OMDb."});
  try {
    const d = await fetchJson(`https://www.omdbapi.com/?apikey=${process.env.OMDB_API_KEY}&s=${encodeURIComponent(q)}`);
    res.json({results:d.Search || [], error:d.Error});
  } catch(e) { res.status(502).json({error:e.message}); }
});

app.get("/api/images", userOnly, async (req,res) => {
  const q = String(req.query.q || "cinema movie theater").trim();
  if (missingKey("UNSPLASH_ACCESS_KEY")) return res.status(503).json({error:"Configura UNSPLASH_ACCESS_KEY en .env para activar Unsplash."});
  try {
    const d = await fetchJson(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=12&orientation=landscape&client_id=${process.env.UNSPLASH_ACCESS_KEY}`);
    res.json({results:(d.results || []).map(i=>({id:i.id,url:i.urls?.regular,thumb:i.urls?.small,alt:i.alt_description,credit:i.user?.name,creditUrl:i.user?.links?.html}))});
  } catch(e) { res.status(502).json({error:e.message}); }
});

app.get("/api/watch/:type/:id", userOnly, async (req,res) => {
  if (missingKey("TMDB_API_KEY")) return res.status(503).json({error:"Configura TMDB_API_KEY en .env"});
  const {type,id}=req.params;
  try {
    const d=await fetchJson(`https://api.themoviedb.org/3/${type==="tv"?"tv":"movie"}/${id}/watch/providers?api_key=${process.env.TMDB_API_KEY}`);
    res.json({country:"PE",providers:d.results?.PE || null});
  } catch(e) {res.status(502).json({error:e.message});}
});


// -------------------- ADMINISTRACIÓN CINEVERSE (MySQL / MariaDB) --------------------
let dbPool;
async function getDb() {
  if (!process.env.DB_HOST || !process.env.DB_NAME || !process.env.DB_USER) {
    throw new Error("MySQL no está configurado. Revisa DB_HOST, DB_NAME, DB_USER y DB_PASSWORD en .env.");
  }
  if (!dbPool) {
    dbPool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: "utf8mb4"
    });
  }
  const connection = await dbPool.getConnection();
  connection.release();
  return dbPool;
}

async function applyContentOverrides(results) {
  try {
    const db = await getDb();
    const [rows] = await db.query(
      "SELECT source, external_id, media_type, is_featured, is_hidden FROM content_overrides"
    );
    const map = new Map(rows.map(x => [`${x.source}:${x.external_id}:${x.media_type}`, x]));
    return results.filter(x => {
      const rule = map.get(`${x.source}:${x.sourceId}:${x.type}`);
      if (rule?.is_hidden) return false;
      if (rule) x.isFeatured = !!rule.is_featured;
      return true;
    }).sort((a, b) => Number(!!b.isFeatured) - Number(!!a.isFeatured));
  } catch {
    return results;
  }
}

function adminOnly(req, res, next) {
  if (req.session?.admin) return next();
  return res.status(401).json({ error: "Sesión administrativa requerida." });
}

function passwordMatches(password, salt, hash) {
  if (typeof salt !== "string" || typeof hash !== "string" || !/^[a-f0-9]{128}$/i.test(hash)) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return expected.length === derived.length && crypto.timingSafeEqual(expected, derived);
}

async function logAdmin(req, action, detail = "") {
  try {
    const db = await getDb();
    await db.execute(
      "INSERT INTO admin_activity (admin_id, action, detail, ip_address) VALUES (?, ?, ?, ?)",
      [req.session.admin.id, action, detail, req.ip]
    );
  } catch (error) {
    console.error("No se pudo registrar actividad administrativa:", error.message);
  }
}

app.get("/admin", (req, res) => res.sendFile(path.join(__dirname, "public", "admin", "index.html")));
app.get("/admin/login", (req, res) => res.sendFile(path.join(__dirname, "public", "admin", "login.html")));

app.post("/api/admin/login", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");
    if (!username || !password) return res.status(400).json({ error: "Completa usuario y contraseña." });

    const db = await getDb();
    const [rows] = await db.execute(
      `SELECT admin_id AS adminId, username, full_name AS fullName,
              password_salt AS passwordSalt, password_hash AS passwordHash,
              role, is_active AS isActive
       FROM admin_users WHERE username = ? LIMIT 1`,
      [username]
    );
    const admin = rows[0];
    if (!admin || Number(admin.isActive) !== 1 ||
        !passwordMatches(password, admin.passwordSalt, admin.passwordHash)) {
      return res.status(401).json({ error: "Usuario o contraseña incorrectos, o cuenta desactivada." });
    }

    req.session.admin = {
      id: admin.adminId,
      username: admin.username,
      name: admin.fullName,
      role: admin.role
    };
    await new Promise((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));
    await db.execute("UPDATE admin_users SET last_login_at = NOW() WHERE admin_id = ?", [admin.adminId]);
    await logAdmin(req, "LOGIN", "Inicio de sesión");
    return res.json({ ok: true, admin: { name: admin.fullName, username: admin.username, role: admin.role } });
  } catch (error) {
    console.error("Error en login administrativo:", error);
    return res.status(503).json({ error: `No se pudo validar el acceso: ${error.message}` });
  }
});

app.post("/api/admin/logout", adminOnly, async (req, res) => {
  await logAdmin(req, "LOGOUT");
  req.session.destroy(() => res.json({ ok: true }));
});
app.get("/api/admin/me", adminOnly, (req, res) => res.json({ admin: req.session.admin }));

app.get("/api/admin/overview", adminOnly, async (req, res) => {
  try {
    const db = await getDb();
    const [[statsRows], [activity], [content]] = await Promise.all([
      db.query(`SELECT
        (SELECT COUNT(*) FROM content_overrides WHERE is_hidden = 0) AS ManagedContent,
        (SELECT COUNT(*) FROM content_overrides WHERE is_featured = 1 AND is_hidden = 0) AS Featured,
        (SELECT COUNT(*) FROM admin_users WHERE is_active = 1) AS Admins,
        (SELECT COUNT(*) FROM admin_activity WHERE created_at >= NOW() - INTERVAL 7 DAY) AS ActivityWeek`),
      db.query("SELECT action AS Action, detail AS Detail, created_at AS CreatedAt FROM admin_activity ORDER BY created_at DESC LIMIT 8"),
      db.query(`SELECT external_id AS ExternalId, media_type AS MediaType, title AS Title,
        poster_url AS PosterUrl, is_featured AS IsFeatured, is_hidden AS IsHidden,
        updated_at AS UpdatedAt FROM content_overrides ORDER BY updated_at DESC LIMIT 8`)
    ]);
    res.json({ stats: statsRows[0], activity, content });
  } catch (error) {
    res.status(503).json({ error: error.message });
  }
});

app.get("/api/admin/content", adminOnly, async (req, res) => {
  try {
    const db = await getDb();
    const [items] = await db.query(`SELECT content_override_id AS ContentOverrideId,
      source AS Source, external_id AS ExternalId, media_type AS MediaType, title AS Title,
      poster_url AS PosterUrl, is_featured AS IsFeatured, is_hidden AS IsHidden,
      notes AS Notes, updated_at AS UpdatedAt FROM content_overrides ORDER BY updated_at DESC`);
    res.json({ items });
  } catch (error) { res.status(503).json({ error: error.message }); }
});

app.post("/api/admin/content", adminOnly, async (req, res) => {
  const x = req.body || {};
  if (!x.source || !x.externalId || !x.mediaType || !x.title) {
    return res.status(400).json({ error: "Faltan source, externalId, mediaType o title." });
  }
  try {
    const db = await getDb();
    await db.execute(`INSERT INTO content_overrides
      (source, external_id, media_type, title, poster_url, is_featured, is_hidden, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE title=VALUES(title), poster_url=VALUES(poster_url),
      is_featured=VALUES(is_featured), is_hidden=VALUES(is_hidden), notes=VALUES(notes)`,
      [x.source, String(x.externalId), x.mediaType, x.title, x.posterUrl || null,
       x.isFeatured ? 1 : 0, x.isHidden ? 1 : 0, x.notes || null]);
    await logAdmin(req, "CONTENT_OVERRIDE", `${x.mediaType}: ${x.title}`);
    res.json({ ok: true });
  } catch (error) { res.status(503).json({ error: error.message }); }
});

app.delete("/api/admin/content/:id", adminOnly, async (req, res) => {
  try {
    const db = await getDb();
    await db.execute("DELETE FROM content_overrides WHERE content_override_id = ?", [Number(req.params.id)]);
    await logAdmin(req, "CONTENT_DELETE", `ID ${req.params.id}`);
    res.json({ ok: true });
  } catch (error) { res.status(503).json({ error: error.message }); }
});

app.get("/api/admin/apis", adminOnly, (req, res) => res.json({ apis: [
  { name: "TMDB", configured: !missingKey("TMDB_API_KEY"), purpose: "Películas, series, tendencias y estrenos" },
  { name: "AniList", configured: true, purpose: "Catálogo y detalles de anime" },
  { name: "Jikan", configured: true, purpose: "Información complementaria de anime" },
  { name: "YouTube Data API", configured: !missingKey("YOUTUBE_API_KEY"), purpose: "Búsqueda de tráileres" },
  { name: "OMDb", configured: !missingKey("OMDB_API_KEY"), purpose: "Datos complementarios e IMDb" },
  { name: "Unsplash", configured: !missingKey("UNSPLASH_ACCESS_KEY"), purpose: "Fondos y fotografías" }
]}));

app.get("/api/admin/settings", adminOnly, async (req, res) => {
  try {
    const db = await getDb();
    const [settings] = await db.query("SELECT setting_key AS SettingKey, setting_value AS SettingValue, description AS Description FROM site_settings ORDER BY setting_key");
    res.json({ settings });
  } catch (error) { res.status(503).json({ error: error.message }); }
});

app.put("/api/admin/settings/:key", adminOnly, async (req, res) => {
  try {
    const db = await getDb();
    await db.execute("UPDATE site_settings SET setting_value = ? WHERE setting_key = ?",
      [String(req.body.value ?? ""), req.params.key]);
    await logAdmin(req, "SETTING_UPDATE", req.params.key);
    res.json({ ok: true });
  } catch (error) { res.status(503).json({ error: error.message }); }
});

app.get("/api/admin/users", adminOnly, async (req, res) => {
  try {
    const db = await getDb();
    const [users] = await db.query(`SELECT admin_id AS AdminId, username AS Username,
      full_name AS FullName, email AS Email, role AS Role, is_active AS IsActive,
      last_login_at AS LastLoginAt, created_at AS CreatedAt
      FROM admin_users ORDER BY created_at DESC`);
    res.json({ users });
  } catch (error) { res.status(503).json({ error: error.message }); }
});

app.get("/api/admin/activity", adminOnly, async (req, res) => {
  try {
    const db = await getDb();
    const [activity] = await db.query(`SELECT a.action AS Action, a.detail AS Detail,
      a.ip_address AS IpAddress, a.created_at AS CreatedAt, u.username AS Username
      FROM admin_activity a LEFT JOIN admin_users u ON u.admin_id = a.admin_id
      ORDER BY a.created_at DESC LIMIT 100`);
    res.json({ activity });
  } catch (error) { res.status(503).json({ error: error.message }); }
});


// -------------------- CUENTAS DE USUARIO CINEVERSE --------------------
function makePassword(password, salt = crypto.randomBytes(32).toString("hex")) {
  return { salt, hash: crypto.scryptSync(password, salt, 64).toString("hex") };
}
function userPasswordMatches(password, salt, hash) {
  if (typeof salt !== "string" || typeof hash !== "string" || !/^[a-f0-9]{128}$/i.test(hash)) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return expected.length === derived.length && crypto.timingSafeEqual(expected, derived);
}
function publicUser(user) {
  return { id: user.user_id, name: user.display_name, email: user.email };
}
app.get("/api/user/me", (req, res) => res.json({ user: req.session.user || null }));
app.post("/api/user/register", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (name.length < 2) return res.status(400).json({ error: "Escribe tu nombre (mínimo 2 caracteres)." });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Escribe un correo electrónico válido." });
    if (password.length < 8) return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres." });
    const db = await getDb();
    const [existing] = await db.execute("SELECT user_id FROM user_accounts WHERE email = ? LIMIT 1", [email]);
    if (existing.length) return res.status(409).json({ error: "Ya existe una cuenta con ese correo electrónico. Inicia sesión." });
    const { salt, hash } = makePassword(password);
    const [result] = await db.execute(
      "INSERT INTO user_accounts (display_name, email, password_salt, password_hash, is_blocked) VALUES (?, ?, ?, ?, 0)",
      [name, email, salt, hash]
    );
    const user = { id: result.insertId, name, email };
    req.session.user = user;
    await new Promise((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));
    res.status(201).json({ ok: true, user });
  } catch (error) {
    console.error("Error registrando usuario:", error);
    res.status(503).json({ error: `No se pudo crear la cuenta: ${error.message}` });
  }
});
app.post("/api/user/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (!email || !password) return res.status(400).json({ error: "Completa tu correo y contraseña." });
    const db = await getDb();
    const [rows] = await db.execute(
      "SELECT user_id, display_name, email, password_salt, password_hash, is_blocked FROM user_accounts WHERE email = ? LIMIT 1", [email]
    );
    const account = rows[0];
    if (!account || Number(account.is_blocked) === 1 || !userPasswordMatches(password, account.password_salt, account.password_hash)) {
      return res.status(401).json({ error: "Correo o contraseña incorrectos, o cuenta bloqueada." });
    }
    const user = publicUser(account);
    req.session.user = user;
    await new Promise((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));
    res.json({ ok: true, user });
  } catch (error) {
    console.error("Error en login de usuario:", error);
    res.status(503).json({ error: `No se pudo validar el acceso: ${error.message}` });
  }
});
app.post("/api/user/logout", userOnly, (req, res) => {
  delete req.session.user;
  req.session.save(err => err ? res.status(500).json({ error: "No se pudo cerrar la sesión." }) : res.json({ ok: true }));
});
app.get("/api/user/favorites", userOnly, async (req, res) => {
  try {
    const db = await getDb();
    const [rows] = await db.execute(
      "SELECT source, external_id AS sourceId, media_type AS type, title FROM user_favorites WHERE user_id = ? ORDER BY created_at DESC",
      [req.session.user.id]
    );
    res.json({ favorites: rows.map(x => ({ ...x, id: `${x.source === "tmdb" ? x.type : x.source === "anilist" ? "anime" : x.source}-${x.sourceId}`, source: x.source, sourceId: x.sourceId, title: x.title })) });
  } catch (error) { res.status(503).json({ error: error.message }); }
});
app.post("/api/user/favorites", userOnly, async (req, res) => {
  try {
    const x = req.body || {};
    if (!x.source || !x.sourceId || !x.type || !x.title) return res.status(400).json({ error: "Faltan datos del contenido." });
    const db = await getDb();
    await db.execute(
      `INSERT INTO user_favorites (user_id, source, external_id, media_type, title) VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE title = VALUES(title)`,
      [req.session.user.id, String(x.source), String(x.sourceId), String(x.type), String(x.title)]
    );
    res.json({ ok: true });
  } catch (error) { res.status(503).json({ error: error.message }); }
});
app.delete("/api/user/favorites/:source/:type/:sourceId", userOnly, async (req, res) => {
  try {
    const db = await getDb();
    await db.execute(
      "DELETE FROM user_favorites WHERE user_id = ? AND source = ? AND media_type = ? AND external_id = ?",
      [req.session.user.id, req.params.source, req.params.type, req.params.sourceId]
    );
    res.json({ ok: true });
  } catch (error) { res.status(503).json({ error: error.message }); }
});

app.get("*", (req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log(`\n🎬 CineVerse ejecutándose en http://localhost:${PORT}\nPulsa Ctrl+C para detener el servidor.\n`));
