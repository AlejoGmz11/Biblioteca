# 📚 MyLibrary

Aplicación web completa de gestión de biblioteca personal multiusuario.

- **Backend:** Java 21 · Spring Boot 3.4 · Spring Security (JWT) · Spring Data JPA · PostgreSQL · Flyway · MapStruct
- **Frontend:** Angular 20 (standalone components + Signals) · SSR con `@angular/ssr` · Tailwind CSS · Chart.js
- **Infraestructura:** Docker Compose para PostgreSQL

## Puesta en marcha

### 1. Base de datos

```bash
docker compose up -d
```

Levanta PostgreSQL 16 en `localhost:5433` (BD `mylibrary`, usuario/contraseña `mylibrary`). Se usa el
puerto 5433 porque el 5432 lo ocupa una instalación nativa de PostgreSQL en la máquina de desarrollo.

También levanta **MinIO** (almacenamiento S3-compatible para los ebooks): API en `localhost:9000` y
consola web en `localhost:9001` (usuario `mylibrary`, contraseña `mylibrary123`). El backend crea el
bucket `mylibrary-ebooks` al arrancar. En producción se apunta a AWS S3 real con las variables
`EBOOK_S3_BUCKET`, `EBOOK_S3_REGION`, `EBOOK_S3_ENDPOINT` (vacío = AWS), `EBOOK_S3_ACCESS_KEY` y
`EBOOK_S3_SECRET_KEY` (o la cadena de credenciales por defecto del SDK: perfil, rol IAM…).

Y **Mailpit**, un servidor SMTP de pruebas que captura los correos (recuperación de contraseña) sin
enviarlos: bandeja web en `localhost:8025`. En producción se configura un SMTP real con `MAIL_HOST`,
`MAIL_PORT` (587), `MAIL_USERNAME`, `MAIL_PASSWORD` y `MAIL_FROM`; y `FRONTEND_URL` para que el enlace
del correo apunte a la app desplegada.

### 2. Backend

```bash
cd backend
mvn spring-boot:run
```

API disponible en `http://localhost:8080`. Flyway crea el esquema y las 8 categorías predefinidas al arrancar. Perfil activo por defecto: `dev` (ver `application.yml`; el perfil `prod` toma la configuración de variables de entorno `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`).

### 3. Frontend

```bash
cd frontend
npm install
npm start          # dev server en http://localhost:4200
```

Para SSR en producción:

```bash
npm run build
npm run serve:ssr  # http://localhost:4000 (incluye /sitemap.xml dinámico)
```

El SSR solo renderiza para los hosts de `security.allowedHosts` en `angular.json` (protección SSRF de
Angular): en producción añade ahí el dominio real. El service worker (PWA) se registra únicamente en
builds de producción.

## Tests

```bash
# Backend: unitarios (JUnit 5 + Mockito) + integración (Testcontainers, requiere Docker)
cd backend && mvn test          # mvn verify aplica el umbral de cobertura JaCoCo (70 %)

# Frontend: Jasmine + Karma
cd frontend && npm test -- --watch=false --browsers=ChromeHeadless
```

Los tests de integración (`@Testcontainers(disabledWithoutDocker = true)`) se omiten automáticamente si Docker no está disponible.

## API REST

Todas las respuestas usan el sobre `{ success, message, data, timestamp }`.

| Método | Endpoint | Descripción |
|---|---|---|
| POST | `/api/auth/register` | Registro (devuelve access + refresh token) |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/refresh` | Renovar tokens |
| POST | `/api/auth/forgot-password` | Pide el enlace de recuperación por email. Responde siempre 200 con el mismo mensaje (no revela si el email existe) |
| POST | `/api/auth/reset-password` | `{ token, newPassword }`: token de un solo uso que caduca a los 30 min; en BD solo se guarda su hash SHA-256 |
| GET | `/api/books` | Listado paginado. Filtros: `status`, `category`, `type`, `author`, `search`, `page`, `size`, `sort` |
| POST / GET / PUT / DELETE | `/api/books[/{id}]` | CRUD de libros |
| GET / PATCH | `/api/books/{id}/session` | Sesión de lectura (estado, fechas, rating 0.5–5 en pasos de media estrella, notas, página actual) |
| GET / POST / PUT / DELETE | `/api/categories[/{id}]` | CRUD de categorías (las predefinidas no se pueden modificar/eliminar) |
| GET | `/api/sagas` | Sagas del usuario con nº de libros; en libros, `saga` (nombre) y `sagaOrder` agrupan; filtro `?saga=<id\|none>` (`none` = autoconclusivos) |
| GET | `/api/stats/dashboard` | Total de libros, por estado, páginas leídas, libros/mes, media de días por libro |
| GET | `/api/export/csv` · `/api/export/json` | Exportación de datos |
| POST | `/api/upload/image` | Subida de portada (multipart, máx. 5 MB) |
| GET | `/api/images/{filename}` | Servir imágenes subidas (público) |
| GET / PATCH | `/api/profile` | Perfil del usuario |
| PATCH | `/api/profile/password` | Cambio de contraseña (requiere la actual; devuelve 400 si no es correcta) |
| POST | `/api/books/{id}/ebook` | Adjuntar/sustituir un PDF o EPUB (multipart `file`, máx. 100 MB, validado por contenido). Rellena título/autor/páginas vacíos con los metadatos del archivo |
| POST | `/api/books/ebook` | Crear un libro digital a partir del archivo (`file` + `title`/`author` opcionales) |
| GET | `/api/books/{id}/ebook` | Stream del ebook para el lector (soporta `Range` → 206/416) |
| GET | `/api/books/{id}/ebook/download` | Descarga del original (`Content-Disposition: attachment`) |
| DELETE | `/api/books/{id}/ebook` | Quitar el archivo (el libro se conserva) |

Los endpoints de `/api/auth/*` tienen rate limiting (10 peticiones/minuto por IP). El resto requiere `Authorization: Bearer <accessToken>` (rol `USER`). Tokens: access 15 min, refresh 30 min. La sesión se cierra tras 30 minutos de inactividad (auto-logout en el frontend + caducidad del refresh token en el backend).

## Arquitectura y patrones (backend)

| Patrón | Dónde |
|---|---|
| DTO | `dto/**` — records inmutables con Bean Validation |
| Builder | Lombok `@Builder`/`@SuperBuilder` en entidades y DTOs |
| Factory | `service/factory/BookFactory` — crea `PhysicalBook`/`DigitalBook`/`AudioBook` (herencia JPA single-table, LSP) |
| Strategy | `service/storage/**` — portadas por URL (`UrlImageStorageStrategy`) o subida local (`LocalImageStorageStrategy`), despacho vía `ImageStorageContext` |
| Observer | `event/**` — `ReadingStatusChangedEvent` publicado al cambiar el estado; `ReadingStatusNotifier` reacciona de forma asíncrona |
| Facade | `service/LibraryFacade` — punto de entrada único de la capa de servicio para los controladores |
| Repository | Spring Data JPA + `BookSpecifications` (filtros componibles) |
| Mapper | MapStruct (`mapper/**`) |
| Excepciones | `@RestControllerAdvice` global con respuestas consistentes |

SOLID: inyección por constructor en todo el proyecto, interfaces segregadas (`ImageStorageStrategy` vs `StoredImageReader`), extensible sin modificar código existente (registro de estrategias/factoría).

## Frontend

- Standalone components con **signal inputs/outputs** y `ChangeDetectionStrategy.OnPush` en todos los componentes.
- Rutas con **lazy loading** (`loadComponent`) y guards funcionales (`authGuard`/`guestGuard`).
- Interceptor JWT con **refresh automático** ante 401.
- **SEO:** títulos y meta tags dinámicos (`SeoService`), Open Graph, JSON-LD `schema.org/Book` en el detalle, sitemap.xml dinámico servido por el servidor SSR, HTML semántico.
- **Accesibilidad (WCAG AA):** skip link, roles ARIA, `aria-live`, `aria-expanded`, `aria-invalid`/`aria-errormessage` en formularios, foco gestionado en diálogos, navegación completa por teclado, tamaños en `rem`, contraste válido también en modo oscuro.
- **Modo oscuro** persistente en `localStorage` (clase `.dark` + Tailwind `darkMode: 'class'`), aplicado antes del primer paint.
- **Ebooks:** subida con drag & drop y barra de progreso, "importar desde archivo" en el alta de libros, y **lector integrado** en `/books/:id/read`: PDF con `pdfjs-dist` (modo página o scroll continuo, zoom, gestos táctiles) y EPUB con `epubjs` (índice, tamaño de letra, tema claro/oscuro). El progreso se sincroniza con la sesión de lectura (página actual / CFI) y se reanuda al reabrir.
- **PWA:** instalable (`manifest.webmanifest` + iconos), app shell y catálogo cacheados por el service worker de Angular (solo en build de producción), y **lectura sin conexión**: "Guardar para leer sin conexión" guarda el archivo en IndexedDB y el lector lo abre aunque la API no responda.
- Componentes compartidos: Navbar, BookCard, BookTable, StarRating, ImageUploader (drag & drop), SearchBar (debounce 300 ms), FilterPanel, StatCard, ConfirmDialog, ToastNotification, DarkModeToggle, Pagination.

## Estructura

```
Libreria/
├── docker-compose.yml
├── backend/
│   └── src/main/java/com/mylibrary/
│       ├── controller/   # REST (delgados, delegan en LibraryFacade)
│       ├── service/      # Facade, servicios, factory, strategies
│       ├── domain/       # Entidades JPA (herencia de tipos de libro)
│       ├── repository/   # Spring Data + Specifications
│       ├── dto/ mapper/  # Records + MapStruct
│       ├── security/     # JWT, filtros, rate limiting
│       ├── event/        # Observer (eventos de dominio)
│       └── exception/    # Manejo global de errores
└── frontend/
    └── src/app/
        ├── core/         # modelos, servicios, guards, interceptor
        ├── shared/       # componentes, pipes y directivas reutilizables
        └── features/     # páginas lazy: auth, dashboard, books, categories, profile, export
```
