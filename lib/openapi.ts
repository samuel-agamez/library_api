/**
 * Especificación OpenAPI 3.1 de la API, GENERADA a partir de los esquemas Zod.
 *
 * Los cuerpos y parámetros de entrada salen de lib/schemas.ts (los mismos que validan cada ruta),
 * así que la documentación no puede contradecir al código. Las rutas y métodos documentados se
 * comparan con los archivos route.ts en tests/openapi.test.ts: si agregas una ruta y olvidas
 * documentarla, la prueba falla.
 */
import { z } from "zod";
import {
  bookQuerySchema,
  coverSchema,
  createLoanSchema,
  loanActionSchema,
  loanQuerySchema,
  loginSchema,
  refreshSchema,
  registerSchema,
} from "./schemas";

type Json = Record<string, unknown>;

/** Convierte un esquema Zod a JSON Schema (sin el campo $schema, que sobra dentro de OpenAPI). */
function toSchema(schema: z.ZodType, io: "input" | "output" = "input"): Json {
  const { $schema, ...rest } = z.toJSONSchema(schema, {
    target: "draft-2020-12",
    io,
    unrepresentable: "any",
  }) as Json;
  void $schema;
  return rest;
}

/** El correo se normaliza antes de validarse (recorte y minúsculas); aquí se documenta como email. */
function withEmailFormat(schema: Json): Json {
  const props = schema.properties as Record<string, Json> | undefined;
  if (props?.email) props.email = { ...props.email, format: "email" };
  return schema;
}

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

// ───────────────────────────── Esquemas de respuesta ─────────────────────────────

const ROLES = ["student", "librarian"] as const;
const LOAN_STATUSES = ["requested", "approved", "rejected", "returned"] as const;
const ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHENTICATED",
  "INVALID_CREDENTIALS",
  "FORBIDDEN",
  "NOT_FOUND",
  "EMAIL_IN_USE",
  "ALREADY_ACTIVE",
  "NO_COPIES",
  "INVALID_STATE",
  "PAYLOAD_TOO_LARGE",
  "RATE_LIMITED",
  "CONFIG_ERROR",
  "INTERNAL_ERROR",
] as const;

const iso = z.string().meta({ format: "date-time" });

const User = z.object({
  uid: z.string(),
  email: z.string().meta({ format: "email" }),
  name: z.string(),
  role: z.enum(ROLES),
});

const AuthResult = z.object({
  tokens: z.object({
    idToken: z.string().describe("JWT de Firebase; se envía como Authorization: Bearer <idToken>"),
    refreshToken: z.string().describe("Sirve para pedir un idToken nuevo en /api/auth/refresh"),
    expiresIn: z.number().int().describe("Segundos de vigencia del idToken"),
  }),
  user: User,
});

const Book = z.object({
  id: z.string(),
  title: z.string(),
  author: z.string(),
  category: z.string(),
  year: z.number().int(),
  description: z.string(),
  totalCopies: z.number().int(),
  availableCopies: z.number().int(),
  coverUrl: z.string().nullable().describe("Ruta relativa a la API o null si no hay portada"),
  updatedAt: iso.describe("Cursor de la sincronización incremental"),
});

const Loan = z.object({
  id: z.string(),
  bookId: z.string(),
  bookTitle: z.string(),
  userId: z.string(),
  userEmail: z.string(),
  userName: z.string(),
  status: z.enum(LOAN_STATUSES),
  clientRequestId: z.string().describe("Llave de idempotencia generada por el cliente"),
  requestedAt: iso,
  resolvedAt: iso.nullable(),
  dueDate: iso.nullable(),
  returnedAt: iso.nullable(),
  updatedAt: iso,
});

const ErrorBody = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

// ───────────────────────────── Piezas reutilizables ─────────────────────────────

const json = (schema: Json) => ({ "application/json": { schema } });

const bearer = [{ bearerAuth: [] }];

const idParam = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "string" },
  description: "Identificador del recurso",
};

/** Convierte las propiedades de un esquema de query en parámetros OpenAPI. */
function queryParams(schema: z.ZodType): Json[] {
  const props = (toSchema(schema).properties ?? {}) as Record<string, Json>;
  return Object.entries(props).map(([name, s]) => ({
    name,
    in: "query",
    required: false,
    schema: s,
  }));
}

const errorResponse = (description: string) => ({
  description,
  content: json(ref("ErrorBody")),
});

const RESPONSES = {
  BadRequest: errorResponse("Datos inválidos (VALIDATION_ERROR)"),
  Unauthorized: errorResponse("Falta el token o es inválido o expiró (UNAUTHENTICATED)"),
  Forbidden: errorResponse("El rol del usuario no permite esta acción (FORBIDDEN)"),
  NotFound: errorResponse("El recurso no existe (NOT_FOUND)"),
  Conflict: errorResponse("Choca con el estado actual (ALREADY_ACTIVE, NO_COPIES, INVALID_STATE…)"),
};

const r = (name: keyof typeof RESPONSES) => ({ $ref: `#/components/responses/${name}` });

// ───────────────────────────── Documento ─────────────────────────────

export function buildOpenApiSpec(): Json {
  return {
    openapi: "3.1.0",
    info: {
      title: "API de la Biblioteca",
      version: "1.0.0",
      description: [
        "API REST de la biblioteca: autenticación con Firebase, catálogo de libros, préstamos y portadas.",
        "",
        "**Cómo probarla desde esta página:** 1) ejecuta `POST /api/auth/login`; 2) copia el `idToken` de la",
        "respuesta; 3) pulsa **Authorize** y pégalo (sin la palabra Bearer). El token dura 1 hora.",
        "",
        "Los errores siempre tienen la forma `{ error: { code, message } }`.",
      ].join("\n"),
    },
    servers: [{ url: "/", description: "El mismo servidor que sirve esta documentación" }],
    tags: [
      { name: "Sistema" },
      { name: "Autenticación" },
      { name: "Libros" },
      { name: "Préstamos" },
    ],
    paths: {
      "/api/health": {
        get: {
          tags: ["Sistema"],
          summary: "Comprueba que el servidor responde",
          security: [],
          responses: {
            "200": {
              description: "Servidor activo",
              content: json({
                type: "object",
                properties: { status: { const: "ok" }, service: { type: "string" } },
              }),
            },
          },
        },
      },
      "/api/openapi.json": {
        get: {
          tags: ["Sistema"],
          summary: "Esta especificación OpenAPI",
          security: [],
          responses: {
            "200": { description: "Documento OpenAPI 3.1", content: json({ type: "object" }) },
          },
        },
      },
      "/api/docs": {
        get: {
          tags: ["Sistema"],
          summary: "Documentación interactiva (Swagger UI)",
          security: [],
          responses: {
            "200": {
              description: "Página HTML",
              content: { "text/html": { schema: { type: "string" } } },
            },
          },
        },
      },

      "/api/auth/register": {
        post: {
          tags: ["Autenticación"],
          summary: "Crea una cuenta de estudiante",
          description:
            "El registro público SIEMPRE crea estudiantes; el rol bibliotecario lo asigna un administrador.",
          security: [],
          requestBody: { required: true, content: json(withEmailFormat(toSchema(registerSchema))) },
          responses: {
            "201": {
              description: "Cuenta creada e inicio de sesión",
              content: json(ref("AuthResult")),
            },
            "400": r("BadRequest"),
            "409": errorResponse("Ya existe una cuenta con ese correo (EMAIL_IN_USE)"),
          },
        },
      },
      "/api/auth/login": {
        post: {
          tags: ["Autenticación"],
          summary: "Inicia sesión con correo y contraseña",
          security: [],
          requestBody: { required: true, content: json(withEmailFormat(toSchema(loginSchema))) },
          responses: {
            "200": { description: "Tokens y usuario", content: json(ref("AuthResult")) },
            "400": r("BadRequest"),
            "401": errorResponse("Correo o contraseña incorrectos (INVALID_CREDENTIALS)"),
          },
        },
      },
      "/api/auth/refresh": {
        post: {
          tags: ["Autenticación"],
          summary: "Cambia un refreshToken por un idToken nuevo",
          security: [],
          requestBody: { required: true, content: json(toSchema(refreshSchema)) },
          responses: {
            "200": { description: "Tokens nuevos", content: json(ref("AuthResult")) },
            "400": r("BadRequest"),
            "401": errorResponse("refreshToken inválido (INVALID_CREDENTIALS)"),
          },
        },
      },
      "/api/auth/me": {
        get: {
          tags: ["Autenticación"],
          summary: "Usuario de la sesión actual",
          security: bearer,
          responses: {
            "200": {
              description: "Usuario y rol",
              content: json({ type: "object", properties: { user: ref("User") } }),
            },
            "401": r("Unauthorized"),
          },
        },
      },

      "/api/books": {
        get: {
          tags: ["Libros"],
          summary: "Lista el catálogo",
          description:
            "`updatedSince` devuelve solo los libros modificados desde esa fecha: es el cursor de la sincronización " +
            "incremental de la app. `serverTime` se toma ANTES de consultar y es el valor para la próxima llamada.",
          security: bearer,
          parameters: queryParams(bookQuerySchema),
          responses: {
            "200": {
              description: "Libros, categorías y hora del servidor",
              content: json({
                type: "object",
                properties: {
                  books: { type: "array", items: ref("Book") },
                  categories: { type: "array", items: { type: "string" } },
                  serverTime: { type: "string", format: "date-time" },
                },
              }),
            },
            "400": r("BadRequest"),
            "401": r("Unauthorized"),
          },
        },
      },
      "/api/books/{id}": {
        get: {
          tags: ["Libros"],
          summary: "Detalle de un libro",
          security: bearer,
          parameters: [idParam],
          responses: {
            "200": {
              description: "El libro",
              content: json({ type: "object", properties: { book: ref("Book") } }),
            },
            "401": r("Unauthorized"),
            "404": r("NotFound"),
          },
        },
      },
      "/api/books/{id}/cover": {
        get: {
          tags: ["Libros"],
          summary: "Imagen de portada",
          description:
            "Pública, con caché de un año: la URL lleva `?v=<coverVersion>` para invalidarla.",
          security: [],
          parameters: [idParam],
          responses: {
            "200": {
              description: "Imagen",
              content: {
                "image/jpeg": { schema: { type: "string", format: "binary" } },
                "image/png": { schema: { type: "string", format: "binary" } },
                "image/webp": { schema: { type: "string", format: "binary" } },
              },
            },
            "404": r("NotFound"),
          },
        },
        put: {
          tags: ["Libros"],
          summary: "Sube la portada de un libro",
          description:
            "Solo bibliotecario. Se comprueban los bytes reales de la imagen, no solo el tipo declarado.",
          security: bearer,
          parameters: [idParam],
          requestBody: { required: true, content: json(toSchema(coverSchema)) },
          responses: {
            "200": {
              description: "El libro con su nueva portada",
              content: json({ type: "object", properties: { book: ref("Book") } }),
            },
            "400": r("BadRequest"),
            "401": r("Unauthorized"),
            "403": r("Forbidden"),
            "404": r("NotFound"),
          },
        },
      },

      "/api/loans": {
        get: {
          tags: ["Préstamos"],
          summary: "Lista préstamos",
          description: "Estudiante: solo los suyos. Bibliotecario: todos.",
          security: bearer,
          parameters: queryParams(loanQuerySchema),
          responses: {
            "200": {
              description: "Préstamos y hora del servidor",
              content: json({
                type: "object",
                properties: {
                  loans: { type: "array", items: ref("Loan") },
                  serverTime: { type: "string", format: "date-time" },
                },
              }),
            },
            "400": r("BadRequest"),
            "401": r("Unauthorized"),
          },
        },
        post: {
          tags: ["Préstamos"],
          summary: "Solicita el préstamo de un libro",
          description:
            "Solo estudiantes. Es IDEMPOTENTE por `clientRequestId`: repetir la misma solicitud devuelve la existente " +
            "(200) en vez de crear otra (201). Solicitar no reserva ejemplares; solo prestar los descuenta.",
          security: bearer,
          requestBody: { required: true, content: json(toSchema(createLoanSchema)) },
          responses: {
            "200": {
              description: "La solicitud ya existía (reintento)",
              content: json({ type: "object", properties: { loan: ref("Loan") } }),
            },
            "201": {
              description: "Solicitud creada",
              content: json({ type: "object", properties: { loan: ref("Loan") } }),
            },
            "400": r("BadRequest"),
            "401": r("Unauthorized"),
            "403": r("Forbidden"),
            "404": r("NotFound"),
            "409": r("Conflict"),
          },
        },
      },
      "/api/loans/{id}": {
        get: {
          tags: ["Préstamos"],
          summary: "Un préstamo",
          description:
            "Un estudiante solo ve los suyos; los ajenos responden 404 (no se revela que existen).",
          security: bearer,
          parameters: [idParam],
          responses: {
            "200": {
              description: "El préstamo",
              content: json({ type: "object", properties: { loan: ref("Loan") } }),
            },
            "401": r("Unauthorized"),
            "404": r("NotFound"),
          },
        },
        patch: {
          tags: ["Préstamos"],
          summary: "Aprueba, rechaza o registra la devolución",
          description:
            "Solo bibliotecario. Máquina de estados: requested → approved → returned, o requested → rejected.",
          security: bearer,
          parameters: [idParam],
          requestBody: { required: true, content: json(toSchema(loanActionSchema)) },
          responses: {
            "200": {
              description: "El préstamo actualizado",
              content: json({ type: "object", properties: { loan: ref("Loan") } }),
            },
            "400": r("BadRequest"),
            "401": r("Unauthorized"),
            "403": r("Forbidden"),
            "404": r("NotFound"),
            "409": r("Conflict"),
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "idToken de Firebase",
        },
      },
      schemas: {
        User: toSchema(User, "output"),
        AuthResult: toSchema(AuthResult, "output"),
        Book: toSchema(Book, "output"),
        Loan: toSchema(Loan, "output"),
        ErrorBody: toSchema(ErrorBody, "output"),
      },
      responses: RESPONSES,
    },
  };
}
