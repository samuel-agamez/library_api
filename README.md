# Biblioteca — API y web (`library_api`)

API REST y sitio web de la Unidad 03 (semanas 9–12), construidos con **Next.js 16**, **React 19**, **TypeScript**, **Firebase Admin** y **Zod**. La app móvil [`../library_app`](../library_app) consume esta API.

Firebase se usa solo desde el servidor; la app nunca recibe credenciales de administrador.

## Requisitos

- Node.js 22.12+
- Proyecto Firebase con Authentication (correo/contraseña) y Firestore

## Configuración

Copia `.env.example` a `.env` y completa:

```env
FIREBASE_PROJECT_ID=tu-proyecto
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@tu-proyecto.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_WEB_API_KEY=AIza...
```

No subas `.env` ni la clave de servicio al repositorio.

## Ejecutar

```bash
npm install
npm run seed
npm run dev
```

Para aceptar conexiones del teléfono: `npm run dev:lan`.

Crear usuarios:

```bash
npm run create-user -- correo@ejemplo.com "Clave" "Nombre" student
npm run create-user -- correo@ejemplo.com "Clave" "Nombre" librarian
```

## API desplegada

- URL: <https://libraryapi-six.vercel.app>
- Estudiante: `estudiante@biblioteca.com` / `tdea2026`
- Bibliotecario: `admin@biblioteca.com` / `tdea2026`

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` / `dev:lan` | Desarrollo local / red local |
| `npm run build` / `start` | Producción |
| `npm test` | Pruebas con Vitest |
| `npm run typecheck` / `lint` | Tipos y reglas de código |
| `npm run seed` | Carga los libros del catálogo |
| `npm run create-user -- ...` | Crea o actualiza un usuario |
| `npm run set-role -- correo rol` | Cambia el rol |
| `npm run smoke` | Prueba contra Firebase real |
| `npm run reset-demo` | Reinicia préstamos y portadas |

## Endpoints

- **Auth:** `POST /api/auth/register`, `/login`, `/refresh`; `GET /api/auth/me`
- **Libros:** `GET /api/books`, `GET /api/books/:id`; `GET/PUT /api/books/:id/cover`
- **Préstamos:** `GET/POST /api/loans`; `PATCH /api/loans/:id`
- **Documentación:** `GET /api/openapi.json`, `GET /api/docs`
- **Salud:** `GET /api/health`

## Estructura

```text
app/api/        API REST (Route Handlers)
app/(auth)/     login y registro web
app/(app)/      catálogo y préstamos web
app/actions.ts  Server Actions
lib/            reglas de negocio, datos, autenticación y OpenAPI
proxy.ts        redirección a /login
scripts/        seed, usuarios, smoke y reset
tests/          pruebas con Vitest
docs/           guía completa (PDF y Markdown)
```

## Notas

- Las reglas de Firestore deben bloquear el acceso directo del cliente (`firestore.rules`).
- Guía completa en `docs/guia-api-web.md`.
