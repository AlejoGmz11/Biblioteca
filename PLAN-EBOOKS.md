# Plan: Ebooks (PDF/EPUB) + Lector integrado + PWA

> Documento de planificación para añadir a MyLibrary la subida de archivos PDF/EPUB
> asociados a los libros, un lector integrado con descarga, y soporte mobile completo (PWA).

## Estado

- **Fecha:** 2026-09
- **Implementación:** completada el 2026-09-12 (fases 1–5). Ajustes respecto al plan original:
  1. EPUB: metadatos parseados con el JDK (ZIP + XML endurecido contra XXE) en lugar de `epublib`, sin mantenimiento desde 2013.
  2. Almacenamiento: una sola clase `S3EbookStorage` configurada por perfil (MinIO en dev, AWS en prod) tras la interfaz `EbookStorage`; MinIO y AWS comparten cliente, así que dos implementaciones eran redundantes.
  3. Lector: el archivo se descarga completo a través del interceptor JWT (refresh automático) y luego se abre en memoria; el `Range` del backend se reenvía a S3 de forma nativa (206/416) y queda disponible para descargas/reanudación.
  4. Modo scroll del PDF: seguimiento por eventos de `scroll` con geometría explícita en vez de `IntersectionObserver` (más robusto cuando la pestaña no recibe frames).
  5. Reanudación offline: además de la sesión en el servidor, la posición se guarda en `localStorage` por libro.
  6. Imagen de MinIO: `quay.io/minio/minio` (ya no se publica en Docker Hub). SSR: `security.allowedHosts` en `angular.json` (protección SSRF de Angular 20.3).
- **Decisiones aprobadas:**
  1. Extracción automática de metadatos del archivo al subir (título, autor) para pre-rellenar el formulario.
  2. Los ebooks se pueden adjuntar a **cualquier tipo de libro** (físico, digital, audio).
  3. Límite de **100MB por archivo**, sin cuota total.

---

## 1. Decisiones clave

| Tema | Decisión | Por qué |
|---|---|---|
| **Almacenamiento S3** | AWS S3 en producción + **MinIO** en docker-compose para desarrollo (compatible S3, sin necesidad de cuenta AWS) | Sigue el patrón Strategy existente de imágenes, configurable por perfil |
| **Autenticación del archivo** | Streaming por backend con JWT (sin URLs firmadas) | Los ebooks son privados; el lector y la descarga pasan siempre por el controlador con comprobación de propietario |
| **Lector PDF** | `pdfjs-dist` (Mozilla), renderizado en canvas + controles propios | Responsive, soporta Range, funciona bien en móvil |
| **Lector EPUB** | `epubjs` | Estándar de facto, permite tema claro/oscuro y ubicación por CFI |
| **Offline** | PWA (`@angular/pwa`) para la app + **IndexedDB** para libros descargados para lectura offline | NG Service Worker no cachea descargas dinámicas grandes; IndexedDB sí |
| **Progreso EPUB** | Nuevo campo `ebook_location` en `reading_sessions` (CFI) | El número de página no aplica a lectura EPUB |
| **Asociación** | Los campos de ebook viven en la entidad base `Book` (opcional/nullable) | Hebras MORFOSYS: el flujo no distingue tipo de libro |
| **Metadatos** | `epublib` (EPUB) y `pdfbox` (PDF) al subir, para pre-rellenar título/autor | Reduce fricción al crear desde archivo |

---

## 2. Arquitectura general

El patrón de almacenamiento replica el existente de imágenes
(`ImageStorageStrategy` → `ImageStorageContext` → `LocalImageStorageStrategy`/`UrlImageStorageStrategy`):

```
EbookStorage (interfaz)
  ├── LocalEbookStorage   → dev (MinIO, S3-compatible)
  └── S3EbookStorage       → prod (AWS S3)

EbookStorageContext (despachador por perfil/proveedor)

service/EbookService       → lógica de negocio (validación, metadatos, propietario)
controller/EbookController → endpoints REST vía LibraryFacade
```

Flujo de la petición: `Controller → LibraryFacade → EbookService → EbookStorageContext → S3`.

---

## 3. Fase 1 — Backend: almacenamiento + API

### 3.1 Infraestructura

- **MinIO** en `docker-compose.yml` (puertos 9000 API / 9001 consola) para desarrollo local.
- Dependencia Maven: `software.amazon.awssdk:s3`.
- Propiedades en `application.yml` (por perfil `dev`/`prod`, vía variables de entorno):
  `bucket`, `endpoint`, `region`, `access-key`, `secret-key`.

### 3.2 Base de datos — migración Flyway `V6__ebooks.sql`

```sql
ALTER TABLE books
    ADD COLUMN ebook_key     VARCHAR(500),
    ADD COLUMN ebook_format  VARCHAR(10),
    ADD COLUMN ebook_size    BIGINT;

ALTER TABLE reading_sessions
    ADD COLUMN ebook_location VARCHAR(1000);
```

- `ebook_key`: referencia del objeto en S3/MinIO (UUID, no adivinable).
- `ebook_format`: `PDF` | `EPUB`.
- `ebook_size`: tamaño en bytes.
- `ebook_location`: CFI/ubicación de lectura para EPUB.
- Todas las columnas nullable: los libros sin archivo no cambian su comportamiento.

### 3.3 Configuración multipart

- Subir `spring.servlet.multipart.max-file-size` a `100MB` y `max-request-size` a `105MB`.
- La validación de 5MB de imágenes sigue en `LocalImageStorageStrategy` (no se ve afectada).

### 3.4 Código backend nuevo

```
service/storage/
  EbookStorage.java           ← interfaz: store / load / delete
  LocalEbookStorage.java      ← dev con MinIO (cliente S3 apuntando al endpoint local)
  S3EbookStorage.java         ← prod con AWS S3
  EbookStorageContext.java    ← despacha por proveedor configurado

service/EbookService.java     ← validación + metadatos + propietario + operaciones
controller/EbookController.java
```

#### Validación por magic bytes (no confiar solo en MIME del cliente)

- PDF: cabecera `%PDF`.
- EPUB: es un ZIP; los primeros bytes son `PK` y debe contener `mimetype`.

#### Endpoints (todos con verificación de propietario del libro)

| Método | Ruta | Función |
|---|---|---|
| `POST` | `/api/books/{id}/ebook` | Adjuntar archivo PDF/EPUB a un libro existente (cualquier tipo). Si campos vacíos y el archivo trae metadatos, rellena título/autor/páginas. |
| `POST` | `/api/books/ebook` | Crear libro desde archivo (multipart + metadatos opcionales). Crea `DigitalBook` y sube el archivo en el mismo request. |
| `GET` | `/api/books/{id}/ebook` | Stream inline con soporte **Range** para el lector. |
| `GET` | `/api/books/{id}/ebook/download` | Descarga con `Content-Disposition: attachment`. |
| `DELETE` | `/api/books/{id}/ebook` | Eliminar el archivo adjunto. |
| — | (en `deleteBook`) | Al borrar un libro, borrar también su ebook del storage. |

### 3.5 Extracción de metadatos (Fase 1b — incluida)

- **EPUB** (`nl.siegmann:epublib`): leer el OPF interno → título, autor (creators), idioma.
- **PDF** (`org.apache.pdfbox`): metadata XMP/Catalog → `title`, `author`.
- Uso:
  - *Crear desde archivo:* formulario llega pre-rellenado; el usuario confirma/corrige.
  - *Adjuntar a existente:* solo rellena campos que están vacíos.

### 3.6 Tests

- Unitarios: `EbookServiceTest` (validación de formatos, propietario, relleno de metadatos, adjuntar/crear/borrar).
- Integración: Testcontainers + contenedor **MinIO**.
  - Upload/stream/download/delete reales contra S3-compatible.
  - Comprobar que un usuario distinto no puede acceder al ebook de otro (403).

---

## 4. Fase 2 — Frontend: subida y creación

### 4.1 Servicios

- `core/services/ebook.service.ts`:
  - `uploadToBook(id, file)`
  - `createFromEbook(file, metadatos)`
  - `streamUrl(id)` → URL autenticada del stream (el interceptor JWT añade el header).
  - `downloadUrl(id)`
  - `delete(id)`
- Actualizar `core/models.ts`:
  - `Book`: campos `ebookKey`, `ebookFormat`, `ebookSize`.
  - `ReadingSession`: campo `ebookLocation`.

### 4.2 Componente `ebook-uploader`

- Reutiliza el patrón drag & drop de `image-uploader.component.ts`.
- Validación en cliente: extensiones `.pdf` / `.epub`, tamaño ≤ 100MB.
- Feedback de progreso de subida (FormData).

### 4.3 Páginas

- **Book detail** (`book-detail.page.ts`):
  - Si existe `ebookKey` → botones **"Leer"** y **"Descargar"**.
  - Sección de gestión de archivo: subir / cambiar / quitar (cualquier tipo de libro).
- **Book form** (`book-form.page.ts`):
  - Modo *adjuntar*: sección de archivo dentro del formulario de un libro existente/nuevo.
  - Modo *crear desde archivo*: subir archivo → formulario pre-rellenado con metadatos extraídos.
- **Book card / table**: badge o ícono indicando que el libro tiene ebook.

---

## 5. Fase 3 — Lector integrado

### 5.1 Ruta

- Nueva ruta lazy: `books/:id/read` → `reader.page.ts` (layout full-screen, responsive, controles táctiles).

### 5.2 Lector PDF — `pdf-reader.component`

- `pdfjs-dist` renderizado en canvas.
- Navegación prev/next, zoom, modo página vs scroll continuo.
- Sincroniza `currentPage` con la sesión de lectura (throttled) vía `PATCH /books/{id}/session` existente.
- Descarga del archivo mediante `fetch` autenticado (JWT por header) para permitir Range/almacenamiento.

### 5.3 Lector EPUB — `epub-reader.component`

- `epubjs`: renderizado por capítulos, TOC, tema claro/oscuro (usa el tema de la app), ajuste de tamaño de fuente.
- Guarda ubicación de lectura (CFI) en `ebook_location` de la sesión.

### 5.4 Progreso

- Reutiliza los endpoints de sesión existentes.
- Al reabrir el reader, se restaura `currentPage` (PDF) o `ebookLocation` (EPUB).

---

## 6. Fase 4 — PWA y offline

### 6.1 PWA

- `ng add @angular/pwa`:
  - `manifest.webmanifest` con nombre, colores de la temática "tierra/biblioteca".
  - Iconos PNG 192/512 + máscara (derivados del favicon SVG actual).
  - `ngsw-config.json` (cache del app shell).
- Registrar `provideServiceWorker()` en `app.config.ts` (compatible con SSR).
- Resultado: instalable en home, arranque rápido, UI funcional offline.

### 6.2 Lectura offline

- `EbookCacheService` con **IndexedDB** (almacenar el Blob completo).
- En la ficha del libro: botón **"Guardar para leer offline"** (y estado "disponible offline").
- El lector prioriza la caché local; si no existe, stream desde servidor.
- Nota: el NG Service Worker no sirve para cachear descargas dinámicas grandes; IndexedDB es la capa correcta aquí.

### 6.3 SSR/PWA

- El service worker actúa solo en cliente; el render SSR existente no cambia.

---

## 7. Fase 5 — Pruebas y pulido

- **Frontend (Karma/Jasmine):** `ebook.service`, `ebook-uploader`, guard de la ruta del lector.
- **Lint:** `npm run lint`.
- **Backend:** `mvn test` (unitarios + integración).
- **Build producción:** `ng build` y arranque del SSR.
- **Verificación manual en móvil:** subida, lectura, guardar offline, instalación PWA, descarga.
- **Accesibilidad del lector:** navegación por teclado, ARIA, contraste en modo oscuro (mantener estándar WCAG AA del proyecto).

---

## 8. Dependencias nuevas

### Backend
- `software.amazon.awssdk:s3`
- `nl.siegmann:epublib` (metadatos EPUB)
- `org.apache.pdfbox` (metadatos PDF)

### Frontend
- `pdfjs-dist`
- `epubjs`
- `@angular/service-worker` (+ scaffolding `@angular/pwa`)

---

## 9. Orden de implementación

1. **Fase 1:** Infraestructura (MinIO, S3 SDK), migración V6, `EbookStorage` + contexto, `EbookService` + metadatos, `EbookController`, tests.
2. **Fase 2:** Servicios frontend, `ebook-uploader`, integración en book detail/form/cards.
3. **Fase 3:** Ruta del lector, `pdf-reader`, `epub-reader`, sincronización de progreso.
4. **Fase 4:** PWA (`@angular/pwa`, service worker, manifest/iconos) + `EbookCacheService` (IndexedDB) y lectura offline.
5. **Fase 5:** Tests frontend, lint, build prod, verificación móvil, accesibilidad.

---

## 10. Riesgos y consideraciones

- **Rendimiento del stream por backend:** para uso personal es correcto; si en el futuro escala, migrar el lector a URLs firmadas de corta duración (se mantiene el controlador de descarga para auditoría).
- **Tamaño 100MB:** los EPUB suelen pesar poco; los PDF sí pueden acercarse. Se valida el límite por archivo en el servicio y en el cliente.
- **OPF vs CFI:** `epubjs` es el estándar; el CFI se guarda como texto y se restaura de forma robusta (fallback al inicio si el CFI no es válido).
- **Cache del Reader:** los componentes del lector no deben quedar en el app-shell ngsw (se excluyen en `ngsw-config.json`) para no duplicar el libro en caché.