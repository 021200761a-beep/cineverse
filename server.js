import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

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
      return res.json({ results: (data.data?.Page?.media || []).map(a => ({
        id:`anime-${a.id}`, sourceId:a.id, source:"anilist", type:"anime",
        title:a.title.english || a.title.romaji, overview:(a.description || "").replace(/<[^>]+>/g,""),
        poster:a.coverImage?.extraLarge || a.coverImage?.large || "", backdrop:a.bannerImage || "",
        year:a.seasonYear || "", rating:a.averageScore ? (a.averageScore/10).toFixed(1) : "—",
        genres:a.genres || [], episodes:a.episodes, url:a.siteUrl
      })) });
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
    res.json({ results: (data.results || []).map(item => normaliseTmdb(item, mediaType)), page: data.page, totalPages: data.total_pages });
  } catch (e) { res.status(502).json({ error: `TMDB: ${e.message}` }); }
});

app.get("/api/search", async (req, res) => {
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
    res.json({ results: unique });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.get("/api/details/:type/:id", async (req, res) => {
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

app.get("/api/trailer", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json({ results:[] });
  if (missingKey("YOUTUBE_API_KEY")) return res.status(503).json({error:"Configura YOUTUBE_API_KEY en .env para activar la búsqueda de tráileres."});
  try {
    const data = await fetchJson(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=8&q=${encodeURIComponent(q+" official trailer")}&key=${process.env.YOUTUBE_API_KEY}`);
    res.json({results:(data.items || []).map(v=>({id:v.id.videoId,title:v.snippet.title,channel:v.snippet.channelTitle,thumbnail:v.snippet.thumbnails?.high?.url}))});
  } catch(e) { res.status(502).json({error:e.message}); }
});

app.get("/api/omdb", async (req,res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json({results:[]});
  if (missingKey("OMDB_API_KEY")) return res.status(503).json({error:"Configura OMDB_API_KEY en .env para activar OMDb."});
  try {
    const d = await fetchJson(`https://www.omdbapi.com/?apikey=${process.env.OMDB_API_KEY}&s=${encodeURIComponent(q)}`);
    res.json({results:d.Search || [], error:d.Error});
  } catch(e) { res.status(502).json({error:e.message}); }
});

app.get("/api/images", async (req,res) => {
  const q = String(req.query.q || "cinema movie theater").trim();
  if (missingKey("UNSPLASH_ACCESS_KEY")) return res.status(503).json({error:"Configura UNSPLASH_ACCESS_KEY en .env para activar Unsplash."});
  try {
    const d = await fetchJson(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=12&orientation=landscape&client_id=${process.env.UNSPLASH_ACCESS_KEY}`);
    res.json({results:(d.results || []).map(i=>({id:i.id,url:i.urls?.regular,thumb:i.urls?.small,alt:i.alt_description,credit:i.user?.name,creditUrl:i.user?.links?.html}))});
  } catch(e) { res.status(502).json({error:e.message}); }
});

app.get("/api/watch/:type/:id", async (req,res) => {
  if (missingKey("TMDB_API_KEY")) return res.status(503).json({error:"Configura TMDB_API_KEY en .env"});
  const {type,id}=req.params;
  try {
    const d=await fetchJson(`https://api.themoviedb.org/3/${type==="tv"?"tv":"movie"}/${id}/watch/providers?api_key=${process.env.TMDB_API_KEY}`);
    res.json({country:"PE",providers:d.results?.PE || null});
  } catch(e) {res.status(502).json({error:e.message});}
});

app.get("*", (req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log(`\n🎬 CineVerse ejecutándose en http://localhost:${PORT}\nPulsa Ctrl+C para detener el servidor.\n`));
