# CineVerse — Node.js + Express

Aplicación web de exploración de películas, series y anime, inspirada en las referencias visuales compartidas. Incluye diseño responsive, buscador, filtros, detalles, favoritos, tráileres, fotografías y proveedores oficiales de streaming cuando TMDB tiene datos para Perú.

## Requisitos
- Node.js 18 o superior (recomendado Node.js 20+).
- Visual Studio Code.
- Conexión a internet.

## Ejecutar en VS Code / Windows

1. Descomprime `CineVerse.zip`.
2. Abre la carpeta `CineVerse` en Visual Studio Code.
3. Abre **Terminal → New Terminal**.
4. Instala las dependencias:

   ```powershell
   npm.cmd install
   ```

5. Crea el archivo `.env` copiando `.env.example`. En PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

6. Abre `.env` y pega las claves de API que hayas solicitado. Como mínimo, configura `TMDB_API_KEY` para las películas y series.
7. Ejecuta el servidor:

   ```powershell
   npm.cmd run dev
   ```

   O bien:

   ```powershell
   npm.cmd start
   ```

8. Abre `http://localhost:3000` en tu navegador.

Para detener el servidor, pulsa `Ctrl + C`.

> Si PowerShell bloquea `npm.ps1`, usa `npm.cmd` como se muestra arriba. No hace falta cambiar la política de seguridad de Windows.

## APIs utilizadas

1. **TMDB** — películas, series, tendencias, detalles y proveedores de streaming.
   - Solicita una clave: https://www.themoviedb.org/settings/api
   - La app consulta los proveedores del país Perú (`PE`) cuando TMDB devuelve esa información.
2. **AniList GraphQL** — búsqueda y catálogo de anime; consultas públicas sin clave para este prototipo.
   - https://docs.anilist.co/
3. **Jikan** — búsqueda y datos adicionales de anime, sin clave.
   - https://jikan.moe/
4. **Unsplash** — búsqueda de fotografías.
   - https://unsplash.com/developers
5. **YouTube Data API v3** — búsqueda de tráileres.
   - https://console.cloud.google.com/
6. **OMDb** — información complementaria de películas/series.
   - https://www.omdbapi.com/apikey.aspx

En `.env`:
```env
PORT=3000
TMDB_API_KEY=tu_clave_tmdb
UNSPLASH_ACCESS_KEY=tu_clave_unsplash
YOUTUBE_API_KEY=tu_clave_youtube
OMDB_API_KEY=tu_clave_omdb
```

Puedes dejar las claves opcionales vacías; sus funciones mostrarán un mensaje indicando cómo activarlas. AniList y Jikan se consultan directamente desde el servidor.

## Botones y funciones
- Menú lateral: Inicio, Películas, Series, Anime, Tendencias, Próximos estrenos, Favoritos y Tráileres.
- Buscador global por título.
- Selector de tipo de contenido.
- Filtros por tendencia, popularidad, puntuación y próximos estrenos.
- Tarjetas clicables para ver detalles.
- Botón de corazón para guardar/quitar favoritos (localStorage del navegador).
- Detalle con sinopsis, reparto cuando existe, géneros, tráileres y proveedores oficiales de streaming cuando están disponibles.
- Ventana para buscar tráileres en YouTube.
- Ventana para buscar fotografías en Unsplash.
- Botón de actualizar, cargar más resultados, perfil de demostración y acerca del proyecto.
- Diseño adaptable a móvil y escritorio.

## Notas importantes
- Las claves privadas se guardan en `.env`, nunca dentro del JavaScript del navegador. No compartas el archivo `.env`.
- El catálogo de proveedores de TMDB puede no incluir todas las plataformas o todos los títulos. La disponibilidad varía por país y fecha; confirma en el servicio oficial.
- Las APIs de catálogo no proporcionan derechos para reproducir películas o episodios completos. Esta app enlaza proveedores oficiales y muestra tráileres publicados en YouTube.
- Unsplash y YouTube tienen límites, políticas y requisitos de atribución/uso. Revisa sus términos.
- Jikan tiene límites de peticiones; evita actualizar repetidamente en poco tiempo.
- Los favoritos se guardan en el navegador actual; no son cuentas sincronizadas.
- Para uso público/comercial, revisa licencias, atribución y términos de cada proveedor.
