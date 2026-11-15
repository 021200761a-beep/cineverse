# CineVerse + CineVerse Admin

Proyecto original de CineVerse conservado y ampliado con un panel administrativo independiente y base de datos Microsoft MySQL / MariaDB.

## 1. Arquitectura
- Sitio público: `http://localhost:3000/` (frontend original).
- Acceso administrador: `http://localhost:3000/admin/login`.
- Panel: `http://localhost:3000/admin`.
- API pública existente: TMDB, AniList, Jikan, YouTube, OMDb y Unsplash.
- Panel privado: sesiones de administrador, gestión de reglas de visibilidad/destacados, estado de APIs, ajustes del sitio y auditoría.
- MySQL / MariaDB almacena administradores, reglas locales de catálogo, ajustes, actividad, cuentas de usuario, favoritos y métricas de búsqueda.

El panel no copia todo el catálogo externo. Al administrar una película/serie/anime se guarda su identificador externo y una regla local. Los resultados ocultos se filtran y los destacados se ordenan primero cuando MySQL / MariaDB está disponible. La ficha original continúa procediendo de su API.

## 2. Requisitos
- Node.js 18+ (recomendado 20 o superior).
- MySQL / MariaDB Express/Developer/Standard y MySQL / MariaDB Management Studio (SSMS).
- VS Code y conexión a internet.

## 3. Crear base de datos
1. Abre SSMS y conecta con tu instancia MySQL / MariaDB.
2. Abre `database/CineVerseDB.sql`.
3. Ejecuta todo el script (F5). Crea `CineVerseDB` y sus tablas.
4. Habilita TCP/IP y autenticación SQL si usarás usuario/contraseña. Asegúrate de que MySQL / MariaDB acepte conexiones en el puerto configurado.

Tablas:
- `AdminUsers`: credenciales hash/salt, roles y estado de administradores.
- `ContentOverrides`: identificadores de APIs con reglas de destacado/ocultación.
- `SiteSettings`: preferencias generales del sitio.
- `AdminActivity`: auditoría de accesos y operaciones.
- `UserAccounts` y `UserFavorites`: estructura preparada para cuentas y favoritos sincronizados.
- `SearchMetrics`: estructura para métricas de búsquedas.

## 4. Configurar el proyecto
En la carpeta raíz:

```powershell
npm.cmd install
Copy-Item .env.example .env
```

Edita `.env` con tus claves de APIs y conexión MySQL / MariaDB:

```env
PORT=3000
TMDB_API_KEY=TU_CLAVE
YOUTUBE_API_KEY=TU_CLAVE
OMDB_API_KEY=
UNSPLASH_ACCESS_KEY=

DB_SERVER=localhost
DB_PORT=1433
DB_DATABASE=CineVerseDB
DB_USER=sa
DB_PASSWORD=TU_PASSWORD_SQL
DB_ENCRYPT=false
DB_TRUST_CERT=true
SESSION_SECRET=CAMBIA_POR_UN_SECRETO_ALEATORIO_LARGO
```

Para MySQL / MariaDB Express, el servidor puede ser `localhost\\SQLEXPRESS`. Si usas autenticación Windows integrada, esta versión requiere configurar un usuario SQL con permisos sobre `CineVerseDB`.

**Seguridad:** no compartas `.env` ni subas claves a GitHub. Para producción cambia `SESSION_SECRET`, usa HTTPS, un almacén persistente de sesiones y restringe el acceso de red a MySQL / MariaDB.

## 5. Crear primer administrador
Desde PowerShell, en la carpeta del proyecto:

```powershell
npm.cmd run admin:create -- --username=admin --name="Administrador CineVerse" --email=admin@cineverse.local --password="UnaClaveLarga123!"
```

Usa una contraseña propia de al menos 12 caracteres. El comando genera salt y hash mediante `scrypt`; no guarda la contraseña en texto plano.

## 6. Iniciar
```powershell
npm.cmd start
```
Desarrollo:
```powershell
npm.cmd run dev
```

Abre:
- Público: `http://localhost:3000/`
- Admin: `http://localhost:3000/admin/login`

## 7. Funciones del panel
- Dashboard: resumen de reglas de catálogo, contenidos destacados, administradores, actividad y estado de APIs.
- Películas / Series / Anime: buscar en la API, seleccionar resultados, marcar destacados y ocultarlos de la vista pública.
- Próximos estrenos: consulta el catálogo de próximos estrenos y permite administrar visibilidad/destacados.
- Tráileres: consulta títulos y administra su ficha/regla de contenido; la búsqueda de vídeos usa la API de YouTube configurada en el sitio público.
- Tendencias y recomendaciones: explorar títulos y destacar contenidos.
- Administradores: consultar administradores. Crear cuentas mediante el comando de servidor seguro.
- Favoritos: apartado preparado; el sitio público actual guarda favoritos en `localStorage` del navegador, por lo que aún no son datos globales en MySQL / MariaDB.
- Estadísticas y reportes: auditoría de actividad administrativa. Las métricas reales de reproducciones/visitas requieren instrumentar eventos en el frontend público.
- Configuración de APIs: estado de configuración. Las claves se mantienen en `.env` y nunca se exponen en el navegador.
- Configuración general: edición de valores de `SiteSettings`.

## 8. Consideraciones
- El panel no puede modificar el catálogo original de TMDB/AniList/Jikan/YouTube; solo controla la presentación local en CineVerse.
- El estado "configurada" comprueba que existe una variable de entorno, no valida una petición real al proveedor.
- Las APIs y sus límites pueden cambiar. Los catálogos requieren claves donde lo indique el sitio.
- El proyecto no reproduce películas ni episodios completos; presenta metadatos y tráileres autorizados/incrustables.
- La conexión MySQL / MariaDB es necesaria para el panel administrativo. Si no está disponible, el sitio público seguirá funcionando, pero las funciones de administración mostrarán un error de conexión.


## Configuración local con XAMPP (MySQL)

1. Inicia Apache y MySQL en XAMPP.
2. Importa `database/cineversedb.sql` desde phpMyAdmin (base `cineversedb`).
3. Revisa `.env`: `DB_HOST=localhost`, `DB_PORT=3306`, `DB_USER=root`, `DB_PASSWORD=` y `DB_NAME=cineversedb`.
4. Ejecuta `npm.cmd install`.
5. Inicia con `npm.cmd start`.
6. Abre `http://localhost:3000/admin/login`.

El SQL incluido ya contiene el administrador `admin`. Su contraseña es `CineVerse2026Seguro!`.
El servidor valida la contraseña con scrypt, usando los campos `password_salt` y `password_hash` de `admin_users`.

## Cuentas de usuarios CineVerse

La portada y el catálogo se pueden explorar como invitado. Para buscar, abrir fichas completas, consultar tráileres, usar herramientas y guardar favoritos, el visitante debe crear una cuenta o iniciar sesión con correo y contraseña.

### Activar la autenticación de usuarios (una sola vez)

1. Abre phpMyAdmin y selecciona `cineversedb`.
2. Entra en la pestaña **SQL**.
3. Ejecuta el contenido de `database/migrations/001_user_accounts_auth.sql` una sola vez.
4. Reinicia CineVerse con `npm.cmd start`.

### Crear una cuenta

Desde la página principal pulsa **Ingresar**, selecciona **Crear cuenta** e introduce nombre, correo y contraseña (mínimo 8 caracteres). El sistema almacena la contraseña usando `scrypt`; nunca se guarda en texto plano.

### Iniciar sesión

Pulsa **Ingresar** e introduce el correo y contraseña con los que te registraste. La sesión se conserva mediante una cookie HTTP-only. Los favoritos se guardan en `user_favorites` vinculados a la cuenta.

**Nota:** las cuentas de visitantes (`user_accounts`) son independientes del administrador del panel (`admin_users`). El acceso `/admin/login` y su usuario SuperAdmin no cambian.


## Correcciones de cuentas de usuario y acceso administrador

Esta versión importa explícitamente `mysql2/promise` y `node:crypto`, necesarios para el pool MySQL y el hash de contraseñas.

### Actualizar una base de datos existente en XAMPP
1. Inicia MySQL en XAMPP.
2. Abre phpMyAdmin y selecciona `cineversedb`.
3. En la pestaña SQL ejecuta `database/CineVerse_Usuarios_Migracion_corregida.sql`.
4. En VS Code ejecuta `npm.cmd install` y luego `npm.cmd start`.

La migración agrega `password_salt` y `password_hash` a `user_accounts` sin borrar cuentas ni administradores existentes.

### Accesos
- Sitio público: `http://localhost:3000/`
- Inicio de sesión de usuario: botón **Ingresar con correo electrónico** en la portada.
- Acceso administrativo: enlace **Acceso administrador** en el pie de página o `http://localhost:3000/admin/login`.

El botón de correo abre el inicio de sesión con correo y contraseña. El acceso de un solo clic mediante Google requiere configurar credenciales OAuth de Google; no se activa automáticamente con solo tener un correo.
