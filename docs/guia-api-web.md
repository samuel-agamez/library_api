---
title: Construye la API y el sitio web de la Biblioteca
subtitle: Tutorial paso a paso con Next.js 16, Firebase y TypeScript. Unidad 03: semanas 9 a 12
kicker: Desarrollo Móvil · Ingeniería en Software · Guía 1 de 2: construye esta primero
header: Guía 1 · API y sitio web
facts: Asignatura=Desarrollo Móvil (PREISESP17015);;Unidad=03 · Integración con API, seguridad y servicios del dispositivo;;Qué construirás=Una API REST con Next.js que usa Firebase (autenticación y datos) y un sitio web con las mismas funciones que la app móvil;;Orden=Esta guía primero (API y web); después la Guía 2 (app móvil con SQLite);;Tecnologías=Next.js 16 (App Router, Route Handlers), React 19, TypeScript, Firebase Admin SDK, Zod, Tailwind CSS, Vitest;;Resultado=Proyecto `library_api` completo, con pruebas, que consume la app móvil
---

# 1. Antes de empezar

## 1.1 Qué vas a construir

Un solo proyecto de Next.js que cumple dos papeles:

1. Una **API REST** (`/api/...`) que consumirá la app móvil: autenticación, catálogo de libros, préstamos y portadas.
2. Un **sitio web** con las mismas funciones que la app: iniciar sesión, listar libros, ver el detalle y solicitar préstamos (estudiante); gestionar préstamos y cambiar portadas (bibliotecario).

{{diagram:architecture}}

Tres ideas explican todo el diseño:

- **La app móvil nunca habla con Firebase.** Solo conoce esta API. Las credenciales de administrador viven únicamente en el servidor.
- **Las reglas de negocio están en un solo lugar** (por ejemplo, "no se presta un libro sin ejemplares"), así que la web y la app se comportan igual.
- **El servidor es la fuente de verdad.** Cuando el teléfono y el servidor no coinciden, gana el servidor.

### Roles y funcionalidades

| Funcionalidad | Estudiante | Bibliotecario | Dónde |
|---|---|---|---|
| Crear cuenta (siempre como estudiante) | ✓ | | App y web |
| Iniciar sesión | ✓ | ✓ | App y web |
| Listar libros, buscar y filtrar | ✓ | ✓ | App y web |
| Ver detalle del libro | ✓ | ✓ | App y web |
| **Solicitar préstamo** | ✓ | | App y web |
| Ver mis préstamos | ✓ | | App y web |
| Ver **todos** los préstamos | | ✓ | App y web |
| Prestar, rechazar, registrar devolución | | ✓ | App y web |
| Cambiar la portada de un libro | | ✓ | App (cámara) y web (archivo) |

No hay límite de usuarios en ningún rol. El catálogo se carga con **10 libros**.

### Endpoints que vas a crear

| Método y ruta | Quién | Qué hace | Semana |
|---|---|---|---|
| `GET /api/health` | Público | Comprueba que el servidor responde | 9 |
| `GET /api/openapi.json` | Público | Especificación OpenAPI de la API (generada desde los esquemas Zod) | 8 |
| `GET /api/docs` | Público | Documentación interactiva (Swagger UI) para probar cada ruta | 8 |
| `GET /api/books?q=&category=&updatedSince=` | Autenticado | Lista de libros; `updatedSince` devuelve solo los modificados | 9 y 10 |
| `GET /api/books/:id` | Autenticado | Detalle de un libro | 9 y 10 |
| `POST /api/auth/register` | Público | Crea un estudiante y devuelve tokens | 10 |
| `POST /api/auth/login` | Público | Inicia sesión | 10 |
| `POST /api/auth/refresh` | Público | Cambia un `refreshToken` por un `idToken` nuevo | 10 |
| `GET /api/auth/me` | Autenticado | Usuario actual y su rol | 10 |
| `GET /api/loans?status=` | Autenticado | Estudiante: los suyos. Bibliotecario: todos | 11 |
| `POST /api/loans` | Estudiante | Solicita un préstamo (idempotente) | 11 |
| `GET /api/loans/:id` | Autenticado | Un préstamo | 11 |
| `PATCH /api/loans/:id` | Bibliotecario | `approve`, `reject` o `return` | 11 |
| `GET /api/books/:id/cover` | Público | Imagen de portada | 12 |
| `PUT /api/books/:id/cover` | Bibliotecario | Sube la portada | 12 |

Todos los errores tienen la misma forma, para que la app reaccione al `code` y no al texto del mensaje:

```json
{ "error": { "code": "NO_COPIES", "message": "No hay ejemplares disponibles" } }
```

### Datos en Firestore

| Colección | Documento | Campos principales |
|---|---|---|
| `books` | `cien-anos-de-soledad` (slug) | `title`, `author`, `category`, `year`, `description`, `totalCopies`, `availableCopies`, `coverVersion`, `updatedAt` |
| `bookCovers` | mismo id del libro | `contentType`, `data` (base64), `updatedAt` |
| `loans` | `{uid}_{clientRequestId}` | `bookId`, `bookTitle`, `userId`, `userEmail`, `userName`, `status`, `clientRequestId`, `requestedAt`, `resolvedAt`, `dueDate`, `returnedAt`, `updatedAt` |
| `users` | `{uid}` | `email`, `displayName`, `role`, `createdAt` |

Estados de un préstamo: `requested` → `approved` → `returned`, o `requested` → `rejected`.

## 1.2 Cómo usar esta guía

Esta guía es un **tutorial de construcción**: al terminarla tienes el proyecto completo y funcionando. No hay archivos "que se dan por hechos". Cada paso tiene una etiqueta de color:

| Etiqueta | Qué debes hacer |
|---|---|
| **CREAR** | Crea el archivo en esa ruta (relativa a la raíz del proyecto) con **exactamente** ese contenido. Si ya existe, reemplázalo completo. |
| **AGREGAR A** | Agrega ese fragmento JSON a un archivo que ya existe (sin borrar lo demás). |
| **AGREGAR AL FINAL DE** | Pega esas líneas al final del archivo. |
| **ELIMINAR** | Borra ese archivo. |
| **TERMINAL** | Ejecuta esos comandos dentro de la carpeta indicada. |

Después de cada semana hay un **punto de control**: ejecuta `pnpm typecheck` y `pnpm test`. Si pasan, sigues; si no, revisa el último archivo que creaste (un error de TypeScript suele indicar un archivo que falta o una letra mal copiada).

> [!IDEA] Trabaja con Git: haz un *commit* al terminar cada semana (`git add -A && git commit -m "semana 9"`). Si algo se rompe, `git diff` te muestra qué cambió.

> [!NOTA] Los comentarios dentro del código están en español y explican el *porqué* de cada decisión. Léelos: son parte de la guía.

## 1.3 Requisitos

- **Node.js 24 LTS** (mínimo 22.5) y **pnpm** (`npm install -g pnpm`). Git y Visual Studio Code.
- Un **proyecto de Firebase** con *Authentication* (correo y contraseña) y *Firestore* habilitados. Ya sabes crearlos; en la sección 2.5 solo configuramos lo nuevo para el servidor.
- Una terminal tipo **bash** (macOS, Linux, WSL o Git Bash en Windows). Los ejemplos usan `curl`; en PowerShell usa `curl.exe` o el equivalente `Invoke-RestMethod`.

## 1.4 Ruta de trabajo (API primero, después la app)

Construye **toda esta guía** (semanas 9 a 12 y el sitio web) y después la **Guía 2** (app móvil). Si en clase avanzan semana a semana, haz primero la sección de la API de esa semana y luego la de la app:

| Semana | Guía 1 (API y web) | Guía 2 (app móvil) | Lo que ya funciona al terminar |
|---|---|---|---|
| 9 | Capítulo 3: REST, validación, catálogo | Capítulo 3: cliente HTTP y estados de pantalla | La app lista libros desde la API |
| 10 | Capítulo 4: Firebase Auth, roles | Capítulo 4: sesión segura y rutas protegidas | Registro, login y roles |
| 11 | Capítulo 5: préstamos, idempotencia, conflictos | Capítulo 5: SQLite offline y sincronización | Solicitudes sin conexión |
| 12 | Capítulo 6: portadas | Capítulo 6: cámara y galería | **Hito 3** |
| — | Capítulo 7: sitio web · Capítulo 8: documentación OpenAPI y pruebas finales | Capítulo 7: pruebas de integración | Entrega |

# 2. Paso 0 · Preparar el proyecto

## 2.1 Crear el proyecto de Next.js

```bash
pnpm create next-app@latest library_api
```

Acepta las opciones recomendadas: **TypeScript**, **ESLint**, **Tailwind CSS**, **App Router**, **Turbopack**, **sin** carpeta `src/` y alias de importación `@/*`. Entra a la carpeta (`cd library_api`) y comprueba que la versión de `next` en `package.json` sea la **16**.

> [!OJO] Esta guía se escribió y se comprobó con Next.js 16.4. Next cambia rápido: si ves una versión mayor, revisa la documentación incluida en `node_modules/next/dist/docs/` antes de copiar código.

## 2.2 Activar `cacheComponents`

Abre `next.config.ts` y asegúrate de que `nextConfig` tenga la línea `cacheComponents: true` (conserva cualquier otra opción que ya traiga tu plantilla):

```ts
const nextConfig: NextConfig = {
  cacheComponents: true,
  // ...el resto de tu configuración
};
```

Con `cacheComponents` activado, todo lo que depende de la petición (cookies, parámetros de búsqueda) debe leerse **dentro de `<Suspense>`**; lo verás en el capítulo del sitio web. Otro cambio de Next 16: el *middleware* ahora se llama **`proxy.ts`**.

## 2.3 Instalar dependencias

Antes de instalar, una advertencia: pnpm 11 exige **decidir** qué hacer con los scripts de instalación de ciertos paquetes (`firebase-admin` trae algunos). Si no lo decides, `pnpm add` termina con el error `ERR_PNPM_IGNORED_BUILDS`. Los de este proyecto son opcionales, así que los dejamos rechazados explícitamente en `pnpm-workspace.yaml` (reemplaza el contenido del archivo):

{{path:api:pnpm-workspace.yaml}}
```yaml
allowBuilds:
  "@firebase/util": false
  esbuild: false
  protobufjs: false
  sharp: false
  unrs-resolver: false
```

Ahora sí, instala:

{{run:api}}
```bash
pnpm add firebase-admin@13 zod@4 server-only
pnpm add -D vitest@5 tsx@4
```

- **firebase-admin**: el SDK de administrador de Firebase (solo corre en el servidor). Usamos la versión **13** a propósito: la 14 depende de una versión de `jwks-rsa` que hace `require()` de un módulo ESM, y en Vercel (cuya versión de Node no controlas) la API se cae con un 500 sin mensaje (`ERR_REQUIRE_ESM`). La 13 funciona en cualquier Node ≥ 18.
- **zod**: validación de entradas.
- **server-only**: hace que el build falle si por error importas código del servidor desde un componente del navegador.
- **vitest**: pruebas. **tsx**: ejecuta scripts de TypeScript (para cargar datos).

## 2.4 Scripts del proyecto

Agrega estos scripts a la sección `"scripts"` de `package.json` (conserva los que ya existen: `dev`, `build`, `start`, `lint`):

{{merge:api:package.json}}
```json
{
  "scripts": {
    "dev:lan": "next dev -H 0.0.0.0",
    "typecheck": "next typegen && tsc --noEmit",
    "test": "vitest run",
    "seed": "tsx --env-file=.env scripts/seed.mts",
    "set-role": "tsx --env-file=.env scripts/set-role.mts",
    "create-user": "tsx --env-file=.env scripts/create-user.mts",
    "smoke": "tsx --env-file=.env scripts/smoke.mts",
    "reset-demo": "tsx --env-file=.env scripts/reset-demo.mts"
  }
}
```

- `dev:lan` hace que el servidor acepte conexiones de tu red local (necesario para usarlo desde el teléfono).
- `typecheck` primero genera los tipos de rutas de Next (`RouteContext`, `PageProps`) y luego revisa TypeScript.
- Los scripts `.mts` los escribiremos más adelante; el sufijo `.mts` los marca como módulos ES, necesarios para usar `await` al nivel superior.

## 2.5 Firebase: lo nuevo para el servidor

Ya sabes crear el proyecto, habilitar *Authentication → Correo/contraseña* y crear *Firestore*. Verifica que ambos estén activos. Lo nuevo es que **el servidor** necesita credenciales de administrador:

1. **Cuenta de servicio:** Consola de Firebase → Configuración del proyecto → *Cuentas de servicio* → **Generar nueva clave privada**. Se descarga un `.json` del que necesitas `project_id`, `client_email` y `private_key`.
2. **Clave de API web:** Configuración del proyecto → *General* → *Tus apps* → app web (créala con `</>` si no tienes una) → `apiKey`. La usaremos para iniciar sesión con la API REST de Firebase Authentication.
3. Crea el archivo `.env` (ya lo ignora git) con tus valores:

```env
FIREBASE_PROJECT_ID=tu-proyecto
FIREBASE_WEB_API_KEY=AIza...
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@tu-proyecto.iam.gserviceaccount.com
# Entre comillas dobles y con los saltos de línea escritos como \n
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

> [!OJO] En el archivo `.env` la llave privada va **entre comillas dobles** (es sintaxis del archivo). En Vercel (sección 9.2) va **sin comillas**. Es el error más frecuente al desplegar.

4. Crea también la plantilla `.env.example` (esta **sí** se sube a git; solo tiene valores de ejemplo):

{{create:api:.env.example}}

5. Evita que las credenciales lleguen a git, pegando esto al final de `.gitignore`:

{{append:api:.gitignore}}
```text
!.env.example

# Firebase service account keys (credenciales de administrador: NUNCA subir a git)
*-firebase-adminsdk-*.json
serviceAccount*.json
```

> [!OJO] El `.json` de la cuenta de servicio es una **credencial de administrador total** de tu proyecto. Cuando copies sus tres valores al `.env`, **mueve o borra el archivo** de la carpeta del proyecto. Si alguna vez se sube a un repositorio público, bórralo desde la consola de Firebase y genera otro.

6. Como solo el servidor accede a Firestore (la cuenta de servicio se salta las reglas), las reglas deben **negar todo** acceso directo desde clientes. En *Firestore → Reglas*:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

{{checkpoint:api:preparacion|typecheck}}

> [!NOTA] **Punto de control 0.** `pnpm typecheck` debe terminar sin errores. Aún no hay código nuestro, pero confirma que el proyecto y TypeScript funcionan.

# 3. Semana 9 · API REST con Route Handlers

**Del microcurrículo:** *Consumo de API REST: HTTP, JSON, asincronía, configuración por ambientes y estados de carga, vacío, error y reintento.* Esta es la contraparte del servidor: el lado que **responde** lo que la app consume.

## 3.1 Conceptos clave

- **Route Handler.** Un archivo `route.ts` dentro de `app/` que exporta funciones con el nombre del método HTTP (`GET`, `POST`, `PATCH`…). La ruta del archivo es la URL: `app/api/books/[id]/route.ts` atiende `/api/books/clean-code`.
- **Código de estado.** `200` éxito · `201` creado · `400` datos inválidos · `401` no autenticado · `403` sin permiso · `404` no existe · `409` conflicto con el estado actual · `500` error del servidor.
- **Nunca confíes en la entrada.** Todo lo que llega (cuerpo, parámetros, cabeceras) se valida antes de usarse.
- **Errores con forma estable.** La app decide qué hacer según `code` (`NO_COPIES`), no según el texto del mensaje.

## 3.2 Paso a paso

### Paso 9.1 · Los tipos del dominio

Todo el proyecto comparte estos tipos. Piensa en ellos como el *contrato* entre la API, el sitio web y la app.

{{create:api:lib/types.ts}}

### Paso 9.2 · Errores con código estable

`ApiError` es el error "de negocio": lleva el estado HTTP y un `code` que la app puede interpretar. Lo lanzaremos desde cualquier capa y un único envoltorio (paso 9.5) lo convertirá en respuesta.

{{create:api:lib/errors.ts}}

### Paso 9.3 · Validar entradas con Zod

Cada endpoint declara el *esquema* de lo que acepta. Si no se cumple, se responde `400` con un mensaje en español. Este archivo reúne los esquemas de todo el proyecto; los de préstamos y portadas los usarás en las semanas 11 y 12.

{{create:api:lib/schemas.ts}}

Detalles que evitan errores reales:

- `z.config(z.locales.es())` traduce los mensajes por defecto de Zod.
- El correo se **normaliza antes de validarse** (recortar espacios y pasar a minúsculas). Los teclados móviles añaden un espacio al autocompletar; validar *antes* de recortar rechazaría correos válidos.
- `clientRequestId` solo admite letras, números, `-` y `_`: se usa para armar el id de un documento y no debe permitir caracteres como `/`.

### Paso 9.4 · Variables de entorno y conexión con Firebase

Las variables se validan **la primera vez que se usan** (no al compilar), para que `pnpm build` no exija secretos. Si falta alguna, el error dice exactamente cuáles:

{{create:api:lib/env.ts}}

`firebase.ts` inicia el Admin SDK una sola vez y expone `adminAuth()` y `db()`. El `import "server-only"` impide usarlo desde el navegador:

{{create:api:lib/firebase.ts}}

### Paso 9.5 · Un envoltorio para unificar errores

Todo Route Handler se envuelve en `route()`: convierte cualquier excepción en la respuesta JSON uniforme y evita que se filtren detalles internos en los errores inesperados. También validamos aquí el cuerpo y los parámetros.

{{create:api:lib/http.ts}}

> [!OJO] La línea `unstable_rethrow(err)` es imprescindible. Next.js usa **excepciones internas** como mecanismo de control (por ejemplo, al leer `request.headers` durante el prerender). Si un `catch` general las captura, la ruta se rompe en silencio. Este error se descubrió al compilar: el log mostraba `NEXT_PRERENDER_INTERRUPTED` tratado como un error 500.

### Paso 9.6 · Acceso a los libros en Firestore

Esta capa es la única que conoce Firestore para los libros. Fíjate en tres decisiones:

- La búsqueda **ignora mayúsculas y tildes** (`colera` encuentra *cólera*).
- `updatedSince` filtra en Firestore por la fecha de modificación: es el cursor de la sincronización de la semana 11.
- `saveCover` y `getCover` los usarás en la semana 12; ya quedan aquí para tener el archivo completo.

{{create:api:lib/data/books.ts}}

### Paso 9.7 · Las rutas del catálogo

Primero, una ruta de salud que no toca Firebase; sirve para comprobar que el servidor responde:

{{create:api:app/api/health/route.ts}}

Ahora el catálogo. **En esta primera versión las rutas todavía no exigen sesión**; en la semana 10 las protegeremos y verás exactamente qué cambia.

{{path:api:app/api/books/route.ts}}
```ts
import { listBooks, listCategories } from "@/lib/data/books";
import { parseQuery, route } from "@/lib/http";
import { bookQuerySchema } from "@/lib/schemas";

/**
 * GET /api/books?q=&category=&updatedSince=
 * Versión de la semana 9: SIN autenticación (se agrega en la semana 10).
 * `serverTime` se toma ANTES de consultar para no perder cambios concurrentes.
 */
export const GET = route(async (request) => {
  const filter = parseQuery(request, bookQuerySchema);
  const serverTime = new Date().toISOString();
  const [books, categories] = await Promise.all([listBooks(filter), listCategories()]);
  return Response.json({ books, categories, serverTime });
});
```

{{path:api:app/api/books/[id]/route.ts}}
```ts
import { getBook } from "@/lib/data/books";
import { route } from "@/lib/http";

export const GET = route(async (_request, ctx: RouteContext<"/api/books/[id]">) => {
  const { id } = await ctx.params;
  return Response.json({ book: await getBook(id) });
});
```

Observa que la ruta solo valida, delega y responde. `RouteContext` es un tipo global que Next genera con `pnpm typecheck`. Y `serverTime` se toma **antes** de consultar: la app lo usará como cursor de la siguiente sincronización.

### Paso 9.8 · Cargar los datos de ejemplo

Este script carga los **10 libros** en Firestore. Es seguro repetirlo: no pisa los ejemplares de libros existentes (con `--reset` los reescribe). **No crea usuarios**: así no queda ninguna cuenta con contraseña conocida escrita en el repositorio. Tus usuarios los creas tú en la semana 10 con `pnpm create-user`.

{{create:api:scripts/seed.mts}}

### Paso 9.9 · Pruebas de la semana

Configura Vitest. `server-only` lanza un error fuera de Next, así que en las pruebas lo reemplazamos por un módulo vacío:

{{create:api:vitest.config.ts}}

{{create:api:tests/stubs/empty.ts}}

Dos archivos de pruebas: uno para los esquemas (incluye el caso del correo con espacios) y otro para el manejo de errores HTTP:

{{create:api:tests/schemas.test.ts}}

{{create:api:tests/http.test.ts}}

{{checkpoint:api:semana-9|typecheck,test}}

> [!NOTA] **Punto de control de la semana 9.** `pnpm typecheck` y `pnpm test` sin errores (verás 2 archivos de pruebas en verde).

## 3.3 Cómo probar con datos reales

```bash
pnpm seed                      # carga los 10 libros (necesita el .env)
pnpm dev                       # en otra terminal
```

```bash
curl -i http://localhost:3000/api/health
curl -s http://localhost:3000/api/books
curl -s 'http://localhost:3000/api/books?q=colera'
curl -s 'http://localhost:3000/api/books?category=Tecnolog%C3%ADa'
curl -s http://localhost:3000/api/books/rayuela
curl -i http://localhost:3000/api/books/no-existe        # 404
curl -i 'http://localhost:3000/api/books?updatedSince=ayer'   # 400: fecha inválida
```

También puedes usar **Bruno** o **Postman**: crea una colección con la variable `baseUrl`.

## 3.4 Evidencia y criterios

> [!EVIDENCIA] Endpoints de catálogo funcionando con validación y errores uniformes; colección de pruebas (curl, Bruno o Postman) con respuestas válidas y de error; `pnpm test` en verde.

- [ ] Todas las entradas pasan por un esquema de Zod
- [ ] Todos los errores tienen la forma `{ error: { code, message } }`
- [ ] Un error inesperado devuelve `500` **sin** mostrar el detalle interno
- [ ] La API responde `404` y `400` donde corresponde

# 4. Semana 10 · Autenticación y autorización con Firebase

**Del microcurrículo:** *Autenticación, autorización y protección de rutas. Manejo de sesión y tokens; secretos, datos personales y registro seguro.*

## 4.1 Conceptos clave

- **Dos APIs de Firebase, dos usos.** El **Admin SDK** (cuenta de servicio) puede todo: crear usuarios, verificar tokens, asignar roles. La **API REST de Auth** (con la `apiKey` web) permite iniciar sesión con correo y contraseña. El servidor usa ambas; la app, ninguna.
- **`idToken`.** JWT firmado por Firebase que dura 1 hora. El servidor lo **verifica** en cada petición.
- **`refreshToken`.** Sirve para pedir un `idToken` nuevo (`/api/auth/refresh`).
- **Custom claims.** Datos extra *firmados* dentro del token. Guardamos `role: "student" | "librarian"`; así autorizar no cuesta una consulta a la base de datos.
- **Autorización ≠ autenticación.** Autenticar es saber *quién* eres; autorizar es decidir *qué puedes hacer*. Un estudiante autenticado sigue sin poder aprobar préstamos.

## 4.2 Paso a paso

### Paso 10.1 · El servicio de autenticación

Verifica tokens, inicia sesión con la API REST de Firebase, renueva sesiones y registra usuarios. Tres detalles de seguridad:

- Un error de credenciales se traduce **siempre al mismo mensaje**, para no revelar si un correo existe.
- El registro público **siempre crea estudiantes**: el rol bibliotecario no se puede pedir desde el registro; se asigna con un script de administración.
- Se inicia sesión **después** de fijar los claims, para que el primer `idToken` ya incluya el rol.

{{create:api:lib/services/auth.ts}}

### Paso 10.2 · Autenticar y autorizar en cada ruta

Dos funciones pequeñas hacen toda la autorización de la API: `requireUser` exige un *Bearer token* válido y `assertRole` exige un rol.

{{create:api:lib/guard.ts}}

### Paso 10.3 · Las rutas de autenticación

Cuatro endpoints delgados: validan con Zod, llaman al servicio y responden.

{{create:api:app/api/auth/login/route.ts}}

{{create:api:app/api/auth/register/route.ts}}

{{create:api:app/api/auth/refresh/route.ts}}

{{create:api:app/api/auth/me/route.ts}}

### Paso 10.4 · Proteger el catálogo

Ahora sí: reemplaza las dos rutas de la semana 9 por estas versiones. La **única diferencia** es la línea `await requireUser(request)` al inicio (y su `import`).

{{create:api:app/api/books/route.ts}}

{{create:api:app/api/books/[id]/route.ts}}

### Paso 10.5 · Scripts de administración

Para crear usuarios con un rol concreto (el primer bibliotecario real) y para cambiar el rol de un usuario existente:

{{create:api:scripts/create-user.mts}}

{{create:api:scripts/set-role.mts}}

`revokeRefreshTokens` obliga a renovar la sesión, de modo que el cambio de rol se aplique pronto y no solo cuando expire el token anterior.

### Paso 10.6 · Pruebas de la semana

La prueba del *guard* simula Firebase y comprueba: `401` sin cabecera, solo esquema `Bearer`, usuario verificado y `403` por rol.

{{create:api:tests/guard.test.ts}}

{{checkpoint:api:semana-10|typecheck,test}}

> [!NOTA] **Punto de control de la semana 10.** `pnpm typecheck` y `pnpm test` en verde (3 archivos de pruebas).

## 4.3 Matriz de autorización

| Endpoint | Sin sesión | Estudiante | Bibliotecario |
|---|---|---|---|
| `GET /api/books`, `/api/books/:id` | 401 | ✓ | ✓ |
| `POST /api/loans` | 401 | ✓ | 403 |
| `GET /api/loans` | 401 | Solo los suyos | Todos |
| `GET /api/loans/:id` | 401 | Solo si es suyo; si no, 404 | ✓ |
| `PATCH /api/loans/:id` | 401 | 403 | ✓ |
| `PUT /api/books/:id/cover` | 401 | 403 | ✓ |

> [!NOTA] Un estudiante que pide por id un préstamo **ajeno** recibe `404`, no `403`: un `403` confirmaría que ese préstamo existe.

## 4.4 Cómo probar

```bash
# Sin token
curl -i http://localhost:3000/api/books                       # 401

# Crea TUS usuarios de prueba (con tus propias contraseñas; no quedan escritas en ningún archivo)
pnpm create-user -- estudiante@tucorreo.com "TuClaveEstudiante" "Tu Estudiante" student
pnpm create-user -- bibliotecario@tucorreo.com "TuClaveBibliotecario" "Tu Bibliotecario" librarian

# También puedes registrar un estudiante desde la API (el registro público siempre crea estudiantes)
curl -s -X POST http://localhost:3000/api/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"ana@correo.co","password":"secreta1","displayName":"Ana"}'

# Iniciar sesión y guardar el token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"estudiante@tucorreo.com","password":"TuClaveEstudiante"}' \
  | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).tokens.idToken")

curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/auth/me
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/books/rayuela
```

## 4.5 Amenazas y controles

| Amenaza | Control |
|---|---|
| Secretos de administrador filtrados | Solo en variables de entorno; `*-firebase-adminsdk-*.json` y `.env*` ignorados por git |
| Escalada de privilegios al registrarse | El registro público siempre crea `student` |
| Un estudiante invoca endpoints de bibliotecario | `assertRole` en cada ruta (se prueba con `403`) |
| Enumeración de correos | Mensaje único para credenciales inválidas; `404` en vez de `403` para recursos ajenos |
| Entradas maliciosas | Validación con Zod en todas las rutas |

## 4.6 Evidencia y criterios

> [!EVIDENCIA] Registro, login, refresh y `me` funcionando; roles por *custom claims*; matriz de autorización comprobada con peticiones manuales; tabla de amenazas del proyecto.

- [ ] Sin token, toda ruta privada responde `401`
- [ ] El registro no permite elegir rol
- [ ] Ningún secreto está en el repositorio (revisa con `git status` y `git log`)

# 5. Semana 11 · Préstamos, sincronización y conflictos en el servidor

**Del microcurrículo:** *Sincronización local-remota: caché, cola de cambios, conflictos y consistencia eventual.* La app implementará el lado del teléfono (Guía 2); la API debe ofrecer tres garantías para que sea **segura**:

| Garantía | Qué problema resuelve | Cómo se logra |
|---|---|---|
| **Cambios incrementales** | No descargar todo el catálogo cada vez | `updatedSince` + `serverTime` como cursor (ya lo hiciste) |
| **Idempotencia** | Reintentar tras perder la respuesta no debe duplicar préstamos | El id del documento se deriva de `{uid}_{clientRequestId}` |
| **Consistencia de ejemplares** | Dos estudiantes no pueden llevarse el último ejemplar a la vez | Transacciones de Firestore |

## 5.1 Paso a paso

### Paso 11.1 · Reglas de dominio puras

Las reglas de negocio son **funciones puras** (sin Firebase ni red): se prueban en milisegundos y se reutilizan igual desde la API y desde la web. Un préstamo está "activo" mientras sea `requested` o `approved`. Los errores `409` de aquí son los **conflictos** que la app móvil explicará al usuario cuando una solicitud hecha sin conexión llegue tarde.

{{create:api:lib/domain/loan-rules.ts}}

### Paso 11.2 · Acceso a los préstamos en Firestore

Lee con calma las dos funciones principales:

- `requestLoan` busca **primero** el documento con id `{uid}_{clientRequestId}`. Si existe, lo devuelve (`created: false`): por eso es seguro reintentar. Todo ocurre en una **transacción**.
- **Solicitar no reserva ejemplares**; solo prestar los descuenta. Dos estudiantes pueden solicitar el último ejemplar: el bibliotecario aprueba uno y la segunda aprobación falla con `NO_COPIES`.
- `transitionLoan` aplica la máquina de estados y descuenta o devuelve el ejemplar de forma atómica.

{{create:api:lib/data/loans.ts}}

### Paso 11.3 · Las rutas de préstamos

`POST /api/loans` es idempotente: responde `201` si creó el préstamo y `200` si ya existía (reintento de la cola offline).

{{create:api:app/api/loans/route.ts}}

{{create:api:app/api/loans/[id]/route.ts}}

### Paso 11.4 · Pruebas de las reglas

{{create:api:tests/loan-rules.test.ts}}

{{checkpoint:api:semana-11|typecheck,test}}

> [!NOTA] **Punto de control de la semana 11.** `pnpm typecheck` y `pnpm test` en verde (4 archivos de pruebas).

## 5.2 Cómo probar

Con `TOKEN` de tu estudiante y `BIB` de tu bibliotecario (los que creaste en 4.4; inicia sesión con el bibliotecario igual que con el estudiante):

```bash
# Solicitar (201) y repetir con el MISMO clientRequestId (200, mismo id: idempotencia)
curl -s -X POST http://localhost:3000/api/loans -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"bookId":"clean-code","clientRequestId":"prueba-0001-abcdef"}'
curl -s -X POST http://localhost:3000/api/loans -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"bookId":"clean-code","clientRequestId":"prueba-0001-abcdef"}'

# Con OTRO clientRequestId para el mismo libro: 409 ALREADY_ACTIVE
curl -s -X POST http://localhost:3000/api/loans -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"bookId":"clean-code","clientRequestId":"prueba-0002-abcdef"}'

# El bibliotecario ve y aprueba (copia el id del préstamo)
curl -s -H "Authorization: Bearer $BIB" http://localhost:3000/api/loans
curl -s -X PATCH http://localhost:3000/api/loans/ID_DEL_PRESTAMO -H "Authorization: Bearer $BIB" \
  -H 'Content-Type: application/json' -d '{"action":"approve"}'

# El estudiante NO puede aprobar: 403
curl -i -X PATCH http://localhost:3000/api/loans/ID_DEL_PRESTAMO -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"action":"approve"}'
```

Para dejar los datos como al inicio: `pnpm reset-demo` (lo creas en la sección 8.2).

## 5.3 Evidencia y criterios

> [!EVIDENCIA] Reglas de préstamo con pruebas unitarias; demostración de idempotencia (misma solicitud dos veces → un solo préstamo) y de conflicto (`NO_COPIES`); explicación de por qué se eligió "gana el servidor".

- [ ] Reenviar la misma solicitud devuelve `200` con el mismo id
- [ ] Una segunda solicitud activa del mismo libro responde `409 ALREADY_ACTIVE`
- [ ] Aprobar sin ejemplares responde `409 NO_COPIES`
- [ ] `GET /api/books?updatedSince=<fecha futura>` devuelve una lista vacía

> [!NOTA] **Limitaciones conocidas, a propósito:** los listados se filtran y ordenan en memoria porque el volumen es pequeño (evita crear índices compuestos en Firestore). Con miles de registros habría que paginar y crear índices.

# 6. Semana 12 · Portadas: el servicio del dispositivo, visto desde el servidor

**Del microcurrículo:** *Integración de un servicio del dispositivo con la API: imágenes… Permisos, validación, manejo de fallos y trazabilidad.* La app toma la foto; la API **valida y guarda**.

## 6.1 Paso a paso

### Paso 12.1 · No confiar en el tipo de archivo declarado

El cliente dice "esto es un PNG", pero no hay que creerle. Se comprueban los primeros bytes del archivo (*magic bytes*): un HTML renombrado como `.png` no pasa.

{{create:api:lib/image.ts}}

### Paso 12.2 · Subir y servir la portada

Decisiones de diseño:

- **Solo el bibliotecario** puede subirla (`assertRole`) y se comprueba el contenido real antes de guardar.
- Se guarda como **base64 en Firestore** (colección `bookCovers`): para este proyecto evita configurar Firebase Storage. El límite de 700 000 caracteres respeta el máximo de 1 MiB por documento.
- La lectura (`GET`) es **pública** y con caché de un año: la URL lleva `?v=<coverVersion>`, así que cada cambio genera una URL nueva y la caché nunca sirve una imagen vieja.
- Subir una portada **actualiza `updatedAt` del libro**, de modo que la sincronización incremental la entrega a todos los dispositivos.
- Se escribe una línea de trazabilidad en el log del servidor (quién, qué libro y cuánto pesó), sin guardar la imagen en el log.

{{create:api:app/api/books/[id]/cover/route.ts}}

### Paso 12.3 · Prueba de la detección de imágenes

{{create:api:tests/image.test.ts}}

{{checkpoint:api:semana-12|typecheck,test}}

> [!NOTA] **Punto de control de la semana 12.** `pnpm typecheck` y `pnpm test` en verde (5 archivos de pruebas, 31 pruebas).

> [!IDEA] En un proyecto real con muchas imágenes lo correcto es **Firebase Storage** (o un CDN) y guardar solo la URL en Firestore. El base64 en la base de datos es una simplificación didáctica.

## 6.2 Cómo probar

```bash
# Con el token del bibliotecario (BIB): sube un PNG pequeño
curl -s -X PUT http://localhost:3000/api/books/clean-code/cover \
  -H "Authorization: Bearer $BIB" -H 'Content-Type: application/json' \
  -d "{\"contentType\":\"image/png\",\"data\":\"$(base64 -w0 portada.png)\"}"
# 403 con el token de un estudiante; 400 si el archivo no es una imagen real
curl -s http://localhost:3000/api/books/clean-code      # coverUrl cambia (?v=1)
```

## 6.3 Evidencia y criterios

> [!EVIDENCIA] Subida de portada desde la app (cámara) y desde la web; rechazo de archivos falsos y de estudiantes; la portada visible en ambos clientes.

- [ ] Un archivo HTML renombrado como `.png` es rechazado con `400`
- [ ] Un estudiante recibe `403`
- [ ] Tras subir, `coverUrl` cambia (`?v=` aumenta) y el libro aparece en `updatedSince`

# 7. El sitio web

El sitio ofrece las mismas funciones que la app usando **Server Components** (se renderizan en el servidor, sin exponer credenciales) y **Server Actions** (formularios que ejecutan código del servidor). Reutiliza *exactamente* las funciones de datos y reglas que construiste en las semanas 9 a 12.

| Función | App móvil | Sitio web |
|---|---|---|
| Registro e inicio de sesión | Pantallas `sign-in` / `sign-up` | `/register` y `/login` |
| Sesión | `expo-secure-store` | Cookie `httpOnly` |
| Listar y buscar libros | SQLite local + sincronización | `/books?q=&category=` (consulta directa) |
| Detalle del libro | `book/[id]` | `/books/[id]` |
| Solicitar préstamo | Cola offline | Acción del servidor (necesita conexión) |
| Mis préstamos / gestión | Pestaña *Mis préstamos* o *Gestión* | `/loans` |
| Cambiar portada | Cámara o galería | Selector de archivo |
| Funciona sin conexión | **Sí** | No |

## 7.1 Sesión del sitio web

La web no guarda tokens en el navegador: usa una **cookie de sesión** `httpOnly` (JavaScript no puede leerla), creada con `createSessionCookie` de Firebase. La capa de acceso a datos (DAL) la verifica en cada página y acción con `requireWebUser()`.

### Paso 13.1 · Cookie y usuario de la sesión

{{create:api:lib/web/session.ts}}

### Paso 13.2 · Acciones del servidor

Cada acción hace lo mismo que la API: valida, comprueba el rol (`requireWebUser("student")`: el botón oculto en la interfaz **no** es una protección) y usa las mismas funciones de datos. `redirect()` lanza una excepción interna, por eso va **fuera** del `try/catch`.

{{create:api:app/actions.ts}}

## 7.2 Componentes de interfaz

Cinco archivos pequeños y reutilizables:

{{create:api:components/ui.tsx}}

{{create:api:components/header.tsx}}

{{create:api:components/auth-form.tsx}}

{{create:api:components/loan-controls.tsx}}

{{create:api:components/book-card.tsx}}

## 7.3 Estilos, layout y redirección

Reemplaza los estilos globales (usa la fuente del sistema y define el tema claro/oscuro):

{{create:api:app/globals.css}}

El *layout* raíz lee la cookie para mostrar el nombre del usuario, así que envuelve el encabezado en `<Suspense>` (regla de `cacheComponents`: lo que depende de la petición no puede bloquear el resto de la página):

{{create:api:app/layout.tsx}}

La página raíz redirige al catálogo:

{{create:api:app/page.tsx}}

`proxy.ts` hace una comprobación **optimista**: solo mira si existe la cookie para mandar rápido a `/login`. La verificación real ocurre en el DAL.

{{create:api:proxy.ts}}

> [!OJO] En el proxy **no** se redirige de `/login` a `/books` cuando hay cookie. Una cookie vencida provocaría un bucle infinito: `/books` → `/login` → `/books`. De eso se encarga la propia página de login (comprueba la sesión y redirige si es válida).

## 7.4 Las páginas

Los archivos entre paréntesis (`(auth)`, `(app)`) son **grupos de rutas**: organizan carpetas sin cambiar la URL. Todas leen datos de la petición (cookies, parámetros), así que el contenido va dentro de `<Suspense>` con un *skeleton* mientras llega.

{{create:api:app/(auth)/login/page.tsx}}

{{create:api:app/(auth)/register/page.tsx}}

{{create:api:app/(app)/books/page.tsx}}

{{create:api:app/(app)/books/[id]/page.tsx}}

{{create:api:app/(app)/loans/page.tsx}}

{{checkpoint:api:sitio-web|typecheck,lint,test,build}}

> [!NOTA] **Punto de control del sitio web.** Además de `pnpm typecheck` y `pnpm test`, ejecuta `pnpm lint` y `pnpm build`: el *build* de Next es el que verifica las reglas de `cacheComponents` (por ejemplo, que no leas `cookies()` fuera de `Suspense`).

Como el contenido se transmite por partes (*streaming*), una URL inexistente como `/books/no-existe` responde `200` con la pantalla de "no encontrado": el código de estado ya se envió cuando se descubre que el libro no existe. Es el comportamiento esperado de este modelo de renderizado.

## 7.5 Cómo probar el sitio

```bash
pnpm dev
```

1. Abre `http://localhost:3000`: te lleva a `/login`.
2. Entra con tu **estudiante** (el que creaste en 4.4): ves el catálogo, buscas `colera`, abres un libro y pulsas **Solicitar préstamo**.
3. Cierra sesión y entra con tu **bibliotecario**: en *Gestión de préstamos* aprueba la solicitud; en el detalle de un libro sube una portada (JPEG, PNG o WebP de hasta ~500 KB).
4. Con una cookie falsa (`library_session=basura` en las herramientas del navegador) la página te devuelve a `/login` sin mostrar datos.

# 8. Documentación OpenAPI, pruebas finales y restablecer datos

## 8.1 Documentar la API con OpenAPI

Hasta ahora la única "documentación" de la API son estas guías. **OpenAPI** es el estándar para describir una API REST en un archivo (`openapi.json`): qué rutas existen, qué reciben, qué responden y quién puede llamarlas. Con él se genera documentación interactiva (**Swagger UI**) y se importa la API en Postman o Bruno.

La clave de diseño: **la especificación se genera desde los esquemas Zod** que ya validan cada ruta (`lib/schemas.ts`). Así la documentación no puede contradecir al código: si cambias una regla de validación, el documento cambia solo. Además, una prueba compara las rutas documentadas con los archivos `route.ts` reales y **falla si agregas una ruta y olvidas documentarla**.

Instala un validador de OpenAPI (solo para las pruebas):

{{run:api}}
```bash
pnpm add -D @seriousme/openapi-schema-validator
```

### Paso 14.1 · El generador de la especificación

`z.toJSONSchema()` (incluido en Zod 4) convierte un esquema Zod a JSON Schema, que OpenAPI 3.1 entiende directamente. Los cuerpos y parámetros de entrada salen de los esquemas reales; las respuestas se describen con esquemas Zod propios y se reutilizan con `$ref`. Cada operación indica si exige sesión (`security: bearerAuth`) y qué errores puede devolver.

{{create:api:lib/openapi.ts}}

### Paso 14.2 · Las dos rutas nuevas

`/api/openapi.json` entrega la especificación y `/api/docs` una página mínima que carga **Swagger UI** desde un CDN (con la versión fijada) y le indica dónde leerla. Ninguna lee datos de la petición, así que Next las genera una sola vez al compilar. Ambas son públicas: `proxy.ts` no interfiere porque excluye `/api`.

{{create:api:app/api/openapi.json/route.ts}}

{{create:api:app/api/docs/route.ts}}

### Paso 14.3 · La prueba que evita el desfase

Cinco comprobaciones: la especificación es OpenAPI 3.1 **válida**; documenta **exactamente** las rutas y métodos de `app/api`; toda operación protegida declara `Bearer` y el `401`; los cuerpos salen de los esquemas Zod (por ejemplo, la misma expresión regular de `clientRequestId`); y `GET /api/openapi.json` responde.

{{create:api:tests/openapi.test.ts}}

{{checkpoint:api:openapi|typecheck,test,lint}}

> [!NOTA] **Punto de control de OpenAPI.** `pnpm typecheck`, `pnpm test` (6 archivos, 36 pruebas) y `pnpm lint` en verde. Para ver que la prueba protege de verdad, crea una carpeta `app/api/prueba/` con un `route.ts` que exporte un `GET` y vuelve a ejecutar `pnpm test`: debe fallar diciendo que `/api/prueba` no está documentada. Bórrala después.

### Cómo probarla

Con `pnpm dev` en marcha, abre `http://localhost:3000/api/docs`:
1. Despliega `POST /api/auth/login`, pulsa *Try it out*, escribe el correo y la contraseña de uno de tus usuarios y pulsa *Execute*.
2. Copia el `idToken` de la respuesta, pulsa **Authorize** (arriba a la derecha) y pégalo, sin la palabra `Bearer`.
3. Prueba `GET /api/books`, `GET /api/auth/me` o cualquier otra ruta. Los candados indican las que exigen sesión.

Para **Postman** o **Bruno**: *Import → Link* con `http://localhost:3000/api/openapi.json` (o la URL de Vercel) y se crean todas las peticiones solas.

> [!IDEA] La especificación documenta lo que la API **hace hoy**: tiene 12 rutas y 15 operaciones, incluidas las dos nuevas. Cuando agregues una ruta, la prueba te obliga a documentarla en `lib/openapi.ts`.

## 8.2 Restablecer los préstamos y las portadas

Borra todos los préstamos, elimina las portadas y restaura los ejemplares (no toca usuarios). Úsalo entre pruebas:

{{create:api:scripts/reset-demo.mts}}

## 8.3 Prueba de humo contra Firebase real

Este script ejecuta **41 comprobaciones de extremo a extremo** contra la API en marcha y **limpia todo lo que crea**. No necesita cuentas fijas: crea un estudiante, otro estudiante y un bibliotecario **temporales** con contraseñas aleatorias, y los elimina al terminar junto con los préstamos y la portada de prueba:

| Bloque | Qué comprueba |
|---|---|
| Autenticación (8) | Salud, `401` sin token, login correcto e incorrecto, roles, refresh y `me` |
| Catálogo (7) | 10 libros, categorías, búsqueda sin tildes, filtro, detalle, `404`, sincronización incremental |
| Préstamos del estudiante (8) | Solicitar, **idempotencia**, `ALREADY_ACTIVE`, `404`, `400`, `403` por rol |
| Gestión del bibliotecario (7) | Aprobar, ejemplares que bajan y vuelven, devolución, sincronización incremental |
| Conflicto de ejemplares (7) | Registro público, correo repetido, **dos estudiantes y un solo ejemplar** (`NO_COPIES`), aislamiento entre usuarios |
| Portada (4) | `403` a estudiantes, archivo falso rechazado, subida y descarga idénticas |

{{create:api:scripts/smoke.mts}}

```bash
pnpm dev                       # en una terminal
pnpm smoke                     # en otra (BASE_URL=http://localhost:3000 por defecto)
pnpm reset-demo                # deja los datos como al inicio
```

Debe terminar con `✅ Todo OK`.

## 8.4 Verificación completa

{{run:api}}
```bash
pnpm typecheck
pnpm test
pnpm lint
pnpm build
```

{{checkpoint:api:final|typecheck,test,lint,build}}

> [!NOTA] **Punto de control final.** Los cuatro comandos sin errores. La API y el sitio web están completos: ahora sigue con la **Guía 2** para construir la app móvil.

# 9. Seguridad y despliegue

## 9.1 Lista de verificación antes de publicar

- [ ] `.env` y el `.json` de la cuenta de servicio **no** están en git (`git status`, `git log -p`)
- [ ] Reglas de Firestore en `allow … if false`
- [ ] En el Firebase de producción no hay cuentas de prueba con contraseñas simples o conocidas (revisa *Authentication → Usuarios*)
- [ ] La API se sirve por **HTTPS** y la app usa esa URL
- [ ] Las variables de entorno están configuradas en el servicio de despliegue, no en el código, y `FIREBASE_PRIVATE_KEY` está **sin comillas**
- [ ] `pnpm build`, `pnpm test`, `pnpm lint` y `pnpm typecheck` sin errores

## 9.2 Desplegar en Vercel

### Paso 1 · Archivo de configuración de Vercel

Vercel detecta Next.js por sí solo al importar el proyecto, pero conviene dejarlo escrito en el repositorio. `vercel.json` **anula** el *Framework Preset* y el *Output Directory* del panel, y evita el error `No Output Directory named "dist"` si el proyecto llegó a quedar configurado como sitio estático (por ejemplo, tras tocar los ajustes de compilación).

{{create:api:vercel.json}}

### Paso 2 · Subir el código a GitHub **sin** secretos

Antes de hacer `git add -A`, comprueba que no suban `.env` ni el `.json` de la cuenta de servicio:

```bash
git status
git ls-files | grep -E "\.env$|adminsdk"     # debe imprimir NADA
```

### Paso 3 · Importar el proyecto

En Vercel: *Add New → Project* y elige el repositorio. Comprueba que el *Framework Preset* diga **Next.js** y **no actives ningún «Override»** en *Build Command*, *Output Directory* ni *Install Command*.

### Paso 4 · Variables de entorno (sin comillas)

En *Settings → Environment Variables* crea las cuatro, marcadas para **Production**. **Ninguna lleva comillas**: las comillas del `.env` son sintaxis del archivo y en Vercel se guardarían como parte del valor.

| Variable | Qué pegar |
|---|---|
| `FIREBASE_PROJECT_ID` | el `project_id` del `.json` (por ejemplo `mi-proyecto-1a2b3`) |
| `FIREBASE_WEB_API_KEY` | la `apiKey` del bloque `firebaseConfig` (empieza por `AIza…`) |
| `FIREBASE_CLIENT_EMAIL` | el `client_email` del `.json` (termina en `.iam.gserviceaccount.com`) |
| `FIREBASE_PRIVATE_KEY` | el `private_key` del `.json`, **solo el texto de adentro** de las comillas |

La llave privada es la que más falla. En el `.json` se ve así:

```text
"private_key": "-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n",
```

En Vercel debe quedar **sin la primera `"` ni la última `"`, y sin la coma**:

```text
-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n
```

Empieza con `-----BEGIN` y termina con `\n` (los `\n` son texto literal). También sirve pegarla con saltos de línea reales.

### Paso 5 · Desplegar y probar

Despliega (o haz *Redeploy* si cambiaste variables: Vercel **no** aplica cambios de variables a despliegues ya hechos). Usa el **dominio de producción** del proyecto (`https://TU-PROYECTO.vercel.app`), no la URL de un despliegue concreto, que suele tener *Deployment Protection* y responde con una página de inicio de sesión de Vercel.

```bash
# 1) La función carga y responde (y la documentación de la API está en /api/docs)
curl https://TU-PROYECTO.vercel.app/api/health

# 2) Credenciales falsas: debe responder 401 INVALID_CREDENTIALS (no 500)
curl -X POST https://TU-PROYECTO.vercel.app/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"prueba@example.com","password":"x12345"}'

# 3) Una cuenta real tuya: debe responder 200 con tokens y el rol
curl -X POST https://TU-PROYECTO.vercel.app/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"estudiante@tucorreo.com","password":"TuClaveEstudiante"}'
```

El paso 3 es el que comprueba que las credenciales de administrador están bien copiadas: si el 2 funciona pero el 3 responde «Sesión inválida o expirada», revisa `FIREBASE_PRIVATE_KEY` (casi siempre son comillas o un `\n` mal copiado).

### Paso 6 · Apuntar la app

En `library_app/.env`: `EXPO_PUBLIC_API_URL=https://TU-PROYECTO.vercel.app`, y reinicia Expo con `npx expo start -c` (Expo guarda las variables en caché y, si no limpias, la app sigue usando la URL anterior y muestra «sin conexión»).

> [!OJO] **No hagas *Redeploy* de despliegues viejos que fallaron:** reconstruyen su commit antiguo, no el último. Si el dominio responde `DEPLOYMENT_NOT_FOUND`, abre el despliegue correcto en *Deployments* y pulsa **Promote to Production**, y revisa que el dominio esté asignado a *Production* en *Settings → Domains*.

# 10. Problemas frecuentes

| Síntoma | Causa probable | Solución |
|---|---|---|
| `CONFIGURATION_NOT_FOUND` al iniciar sesión | Authentication no está inicializado | Consola → Authentication → *Comenzar* y habilitar correo/contraseña |
| `SERVICE_DISABLED` o `PERMISSION_DENIED` en Firestore | No se creó la base de datos o su API está desactivada | Consola → Firestore → *Crear base de datos* (puede tardar unos minutos en propagarse) |
| `Faltan variables de entorno: …` | Falta una variable (en `.env` o en Vercel) o su nombre está mal escrito | Revisa `.env.example` y los nombres exactos. En `.env` la clave va entre comillas con `\n`; en Vercel, sin comillas |
| `Top-level await is currently not supported` al ejecutar scripts | Un script `.ts` se interpreta como CommonJS | Los scripts son `.mts` (ESM) y se ejecutan con `tsx` |
| `ERR_PNPM_IGNORED_BUILDS` | pnpm 11 pide decidir sobre scripts de instalación | Crea `pnpm-workspace.yaml` **antes** de instalar, como en el paso 2.3 |
| El teléfono no llega a la API | La API escucha solo en `localhost` o hay firewall | `pnpm dev:lan`, misma red Wi-Fi, abrir el puerto 3000 (en WSL2 ver la Guía 2) |
| Un bibliotecario nuevo aparece como estudiante | Su token tiene el rol anterior | Cerrar sesión y volver a entrar |
| `409 ALREADY_ACTIVE` | Ya hay una solicitud o préstamo activo del libro | Es una regla de negocio, no un error |
| El build de Next falla por `cookies()` o `headers()` | Se leyó un dato de la petición fuera de `Suspense` | Mueve la lectura a un componente dentro de `<Suspense>` |
| En Vercel todas las rutas con Firebase dan 500 sin cuerpo; en los logs: `ERR_REQUIRE_ESM … jose … jwks-rsa` | Estás usando `firebase-admin` 14 con un Node de Vercel anterior a 22.12 | Usa `firebase-admin@13` (paso 2.3): `pnpm add firebase-admin@13`, sube el cambio y haz *Redeploy* |
| En Vercel, `Sesión inválida o expirada` al iniciar sesión con una cuenta real (con credenciales falsas sí responde `INVALID_CREDENTIALS`) | `FIREBASE_PRIVATE_KEY` mal copiada: casi siempre con comillas | Pégala **sin comillas** (paso 9.2.4) y haz *Redeploy* |
| Vercel: `No Output Directory named "dist" found` | El proyecto quedó como sitio estático / con *Override* en el panel | Deja `vercel.json` (paso 9.2.1), o pon *Framework Preset* = Next.js y apaga los *Override*; haz *Redeploy* del **último** commit |
| El dominio responde `DEPLOYMENT_NOT_FOUND` | El dominio no apunta a ningún despliegue vigente | *Deployments* → el último despliegue → **Promote to Production**; revisa *Settings → Domains* |
| La app muestra «sin conexión» con la URL de Vercel bien escrita | Expo conserva la URL vieja en caché | Reinicia con `npx expo start -c` y recarga la app |
| `pnpm test` falla en `openapi.test.ts` con «documenta exactamente las rutas…» | Agregaste, quitaste o cambiaste el método de una ruta en `app/api` sin actualizar `lib/openapi.ts` | Documenta la ruta (o bórrala de la especificación) en `lib/openapi.ts` |
| `/api/docs` carga en blanco | No hay internet o el CDN (jsDelivr) está bloqueado: Swagger UI se descarga de allí | Revisa la conexión; `/api/openapi.json` sigue funcionando para Postman o Bruno |
| `pnpm typecheck` dice que no existe `RouteContext` o `PageProps` | Aún no se generaron los tipos de rutas | Ejecuta `pnpm typecheck` (corre `next typegen` primero) |

# 11. Bitácora de uso de IA generativa

Registra cada uso: propósito, qué obtuviste, cómo lo **validaste** (pruebas, documentación, ejecución) y qué decidiste. Nunca pegues credenciales ni el contenido del `.env` en un asistente.

| Fecha | Herramienta y prompt (resumido) | Qué respondió | Cómo lo validé | Decisión |
|---|---|---|---|---|
| (ej.) Sem. 10 | *"¿Cómo verifico un idToken de Firebase en Next.js?"* | Sugirió decodificar el JWT a mano | Lo contrasté con la documentación del Admin SDK: decodificar no verifica la firma | Rechazada; usé `verifyIdToken` |
| (ej.) Sem. 11 | *"Escribe pruebas para la regla de ejemplares"* | 6 casos | Los ejecuté con `pnpm test`; agregué el caso del límite de ejemplares que faltaba | Aceptada con ajustes |
| | | | | |

# 12. Referencias

- Next.js. *Route Handlers*, *Proxy* y *Authentication*. Documentación incluida en `node_modules/next/dist/docs/`.
- Firebase. *Admin SDK: verify ID tokens, custom claims, session cookies*. https://firebase.google.com/docs/auth/admin
- Firebase. *Auth REST API*. https://firebase.google.com/docs/reference/rest/auth
- Firebase. *Transactions (Firestore)*. https://firebase.google.com/docs/firestore/manage-data/transactions
- Zod. https://zod.dev
- OWASP. *Application Security Verification Standard (ASVS)* y *MASVS*. https://mas.owasp.org
- UNESCO (2023). *Guidance for generative AI in education and research*. https://unesdoc.unesco.org/ark:/48223/pf0000386693
