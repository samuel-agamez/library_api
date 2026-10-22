import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionCookie, SESSION_MAX_AGE_MS } from "../services/auth";
import type { AuthUser, Role } from "../types";

export const SESSION_COOKIE = "library_session";

export async function setSessionCookie(value: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, value, {
    httpOnly: true, // inaccesible para JavaScript del navegador
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_MS / 1000,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Usuario de la sesión web o null. `cache` evita verificar la cookie varias veces por petición. */
export const getWebUser = cache(async (): Promise<AuthUser | null> => {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!value) return null;
  try {
    return await verifySessionCookie(value);
  } catch {
    return null;
  }
});

/** Capa de acceso a datos (DAL): cada página/acción pide el usuario aquí, no confía solo en proxy.ts. */
export async function requireWebUser(role?: Role): Promise<AuthUser> {
  const user = await getWebUser();
  if (!user) redirect("/login");
  if (role && user.role !== role) redirect("/books");
  return user;
}
