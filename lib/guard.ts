import "server-only";
import { ApiError } from "./errors";
import { verifyIdToken } from "./services/auth";
import type { AuthUser, Role } from "./types";

/** Autenticación de la API móvil: Authorization: Bearer <idToken de Firebase>. */
export async function requireUser(request: Request): Promise<AuthUser> {
  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    throw new ApiError(401, "UNAUTHENTICATED", "Falta el token de autenticación");
  }
  return verifyIdToken(token);
}

/** Autorización por rol (el rol viaja como custom claim dentro del idToken). */
export function assertRole(user: AuthUser, role: Role): void {
  if (user.role !== role) {
    throw new ApiError(403, "FORBIDDEN", "No tienes permisos para esta acción");
  }
}
