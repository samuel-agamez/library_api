# Biblioteca — API y sitio web (`library_api`)

Proyecto **Next.js 16** (App Router) de la Unidad 03 *Integración con API, seguridad y servicios del dispositivo* (semanas 9 a 12). Cumple dos papeles:

1. **API REST** (`/api/...`) que consume la app móvil [`../library_app`](../library_app).
2. **Sitio web** con las mismas funciones que la app: catálogo, detalle, préstamos (estudiante) y gestión de préstamos/portadas (bibliotecario).

Firebase (Authentication + Firestore) se usa **solo desde el servidor**: la app móvil nunca recibe credenciales de administrador.

## Arquitectura

```text
App móvil (Expo)  ──HTTPS/JSON──▶  library_api (Next.js)  ──Admin SDK──▶  Firebase
   SQLite + cola offline              reglas de negocio              Auth + Firestore
```

- Las reglas de negocio viven en un solo lugar (`lib/domain`), así la web y la app se comportan igual.
- El servidor es la fuente de verdad; si el teléfono y el servidor difieren, gana el servidor.
- Los secretos (`FIREBASE_PRIVATE_KEY`, etc.) existen únicamente en el servidor (`.env` local o variables de entorno en Vercel).

## Requisitos

- **Node.js 22.12 o superior** (probado con **24.19.0**). Next 16 y Vitest 5 no funcionan en Node 20.
- npm (o pnpm 11, también requiere Node ≥ 22.12).
- Un proyecto **Firebase** con *Authentication → Correo/contraseña* y una base **Firestore**.

## Configurar Firebase (una sola vez)

1. Entra a <https://console.firebase.google.com> y crea un proyecto.
2. **Authentication → Comenzar → Correo/contraseña → Habilitar**.
3. **Firestore Database → Crear base de datos** (modo producción). El Admin SDK no usa las reglas de cliente, pero conviene dejar el acceso directo cerrado: todo pasa por la API.
4. **Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada**: descarga el `.json`.
5. **Configuración del proyecto → General → Clave de API web** (`AIza...`), necesaria para el login por REST.

Copia `.env.example` a `.env` y completa las cuatro variables:

```env
FIREBASE_PROJECT_ID=tu-proyecto
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@tu-proyecto.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_WEB_API_KEY=AIza...
```

> La llave privada va **entre comillas dobles** y con los saltos de línea escritos como `\n`.
> El `.json` de la cuenta de servicio y el `.env` están en `.gitignore`: **nunca** se suben al repositorio. Borra el `.json` después de copiar los valores.

## Instalar y ejecutar

```bash
npm install            # si npm falla por peers: npm install --legacy-peer-deps
npm run seed           # carga los 10 libros del catálogo (no crea usuarios)
npm run dev            # http://localhost:3000
npm run dev:lan        # acepta conexiones de la red local (para el teléfono)
```

Crea las cuentas (la contraseña solo queda en tu terminal):

```bash
npm run create-user -- estudiante@tucorreo.com "TuClave" "Tu Nombre" student
npm run create-user -- bibliotecario@tucorreo.com "TuClave" "Tu Nombre" librarian
```

## API desplegada

Ya está publicada en Vercel (proyecto `samuel-vg/library_api`):

- URL: <https://libraryapi-six.vercel.app>
- Alias: <https://libraryapi-samuel-vg.vercel.app>
- Estudiante: `estudiante@biblioteca.com` / `tdea2026`
- Bibliotecario: `admin@biblioteca.com` / `tdea2026`

Las cuatro variables de Firebase están cargadas como *Secret* en los entornos Production y Preview. Para volver a desplegar:

```bash
vercel deploy --prod
```

> Si cambias las variables, hazlo con `vercel env add <NOMBRE> --environment 'production,preview' --force` y vuelve a desplegar.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` / `npm run dev:lan` | Desarrollo (el segundo acepta conexiones de la red local) |
| `npm run build` / `npm start` | Producción |
| `npm run test` | Pruebas unitarias (Vitest): 36 pruebas |
| `npm run typecheck` / `npm run lint` | Tipos y reglas de código |
| `npm run seed` | Carga los 10 libros (no crea usuarios) |
| `npm run create-user -- correo clave "Nombre" librarian` | Crea (o actualiza) un usuario `student`/`librarian` |
| `npm run set-role -- correo librarian` | Cambia el rol de un usuario existente |
| `npm run smoke` | Prueba de humo contra Firebase real (usa usuarios temporales y limpia lo que crea) |
| `npm run reset-demo` | Borra préstamos y portadas y restaura los ejemplares |

## Endpoints

| Ruta | Quién |
|---|---|
| `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`, `GET /api/auth/me` | Público / autenticado |
| `GET /api/books` (`?q=&category=&updatedSince=`), `GET /api/books/:id` | Autenticado |
| `GET /api/books/:id/cover` | Público |
| `PUT /api/books/:id/cover` | Bibliotecario |
| `GET /api/loans`, `POST /api/loans` (idempotente por `clientRequestId`) | Autenticado / estudiante |
| `PATCH /api/loans/:id` (`approve`, `reject`, `return`) | Bibliotecario |
| `GET /api/openapi.json`, `GET /api/docs` | Público (OpenAPI y Swagger UI) |
| `GET /api/health` | Público |

Los errores son uniformes: `{ "error": { "code": "NO_COPIES", "message": "..." } }`.

## Estructura

```text
app/api/        Route Handlers (la API)
app/(auth)/     login y registro del sitio web
app/(app)/      catálogo y préstamos del sitio web
app/actions.ts  Server Actions
lib/domain/     reglas de préstamo (puras, con pruebas)
lib/data/       acceso a Firestore
lib/services/   Firebase Authentication
lib/openapi.ts  especificación OpenAPI generada desde Zod
proxy.ts        redirección optimista a /login (antes middleware)
scripts/        seed, create-user, set-role, smoke, reset-demo
tests/          pruebas con Vitest
docs/           guía completa (Markdown y PDF)
```

## Verificación

```bash
npm run test        # 36 pruebas
npm run typecheck
npm run lint
npm run build
```

Resultado en este equipo: **36/36 pruebas, tipos, lint y build correctos**.

## Desplegar en Vercel

1. Sube este repositorio a GitHub.
2. En Vercel: **Add New Project → Import** y selecciona el repo.
3. En **Settings → Environment Variables** agrega las cuatro variables (la llave privada con `\n`).
4. Deploy. Las rutas `/api/*` quedan disponibles en el dominio de Vercel.
5. En la app móvil, apunta `EXPO_PUBLIC_API_URL` a ese dominio.

## Seguridad

- No hay credenciales en el cliente: la app solo conoce la URL de la API.
- `.env`, `.env.local` y las claves de servicio están ignorados por git.
- Roles y permisos se validan en el servidor (`lib/guard.ts`), no en la interfaz.
- Límites de tamaño/tipo de imagen y validación con Zod en cada entrada.

## Documentación de la unidad

- `docs/Guia_API_Web_Biblioteca.pdf` — Guía 1 (API y web), semanas 9 a 12.
- `docs/guia-api-web.md` — la misma guía en Markdown, con el código completo.
- Guía 2 (app móvil): [`../library_app/docs/Guia_App_Movil_Biblioteca.pdf`](../library_app/docs/Guia_App_Movil_Biblioteca.pdf).

> Nota: Next.js 16.4.0 tenía un aviso de seguridad que bloqueaba `next build`; este proyecto quedó en **Next 16.4.2** (y `eslint-config-next` 16.4.2).
