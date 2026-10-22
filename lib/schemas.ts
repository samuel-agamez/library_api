import { z } from "zod";

// Mensajes de validación por defecto en español (ej. "Invalid input" → "Entrada inválida").
z.config(z.locales.es());

/** Primero se normaliza (los teclados móviles añaden espacios al autocompletar) y luego se valida. */
const emailField = z.string().trim().toLowerCase().pipe(z.email("Correo inválido"));

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "La contraseña es obligatoria"),
});

export const registerSchema = z.object({
  email: emailField,
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  displayName: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(80),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const createLoanSchema = z.object({
  bookId: z.string().min(1).max(120),
  clientRequestId: z
    .string()
    .min(8)
    .max(100)
    .regex(/^[A-Za-z0-9_-]+$/, "Formato de clientRequestId inválido"),
});

export const loanActionSchema = z.object({
  action: z.enum(["approve", "reject", "return"]),
});

/** Límite de la portada en base64: Firestore admite 1 MiB por documento. */
export const MAX_COVER_BASE64_LENGTH = 700_000;

export const coverSchema = z.object({
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  data: z
    .string()
    .min(100)
    .max(MAX_COVER_BASE64_LENGTH, "La imagen es demasiado grande")
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, "Base64 inválido"),
});

export const bookQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(60).optional(),
  updatedSince: z.iso.datetime().optional(),
});

export const loanQuerySchema = z.object({
  status: z.enum(["requested", "approved", "rejected", "returned"]).optional(),
});
