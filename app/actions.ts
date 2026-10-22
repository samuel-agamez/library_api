"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { saveCover } from "@/lib/data/books";
import { requestLoan, transitionLoan } from "@/lib/data/loans";
import { ApiError } from "@/lib/errors";
import { sniffImageType } from "@/lib/image";
import {
  loanActionSchema,
  loginSchema,
  registerSchema,
  MAX_COVER_BASE64_LENGTH,
} from "@/lib/schemas";
import { createSessionCookie, login, register } from "@/lib/services/auth";
import { clearSessionCookie, requireWebUser, setSessionCookie } from "@/lib/web/session";

export interface FormState {
  error?: string;
  ok?: string;
}

function messageOf(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  console.error("[web] error no controlado:", err);
  return "Ocurrió un error inesperado. Inténtalo de nuevo.";
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  try {
    const { tokens } = await login(parsed.data.email, parsed.data.password);
    await setSessionCookie(await createSessionCookie(tokens.idToken));
  } catch (err) {
    return { error: messageOf(err) };
  }
  redirect("/books"); // redirect lanza una excepción: va fuera del try/catch
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  try {
    const { email, password, displayName } = parsed.data;
    const { tokens } = await register(email, password, displayName);
    await setSessionCookie(await createSessionCookie(tokens.idToken));
  } catch (err) {
    return { error: messageOf(err) };
  }
  redirect("/books");
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}

export async function requestLoanAction(bookId: string): Promise<FormState> {
  const user = await requireWebUser("student");
  try {
    const { created } = await requestLoan(user, bookId, randomUUID());
    revalidatePath("/loans");
    return {
      ok: created ? "Solicitud enviada. El bibliotecario la revisará." : "La solicitud ya existía.",
    };
  } catch (err) {
    return { error: messageOf(err) };
  }
}

export async function loanTransitionAction(loanId: string, action: string): Promise<FormState> {
  await requireWebUser("librarian");
  const parsed = loanActionSchema.safeParse({ action });
  if (!parsed.success) return { error: "Acción inválida" };
  try {
    await transitionLoan(loanId, parsed.data.action);
    revalidatePath("/loans");
    revalidatePath("/books");
    return { ok: "Actualizado" };
  } catch (err) {
    return { error: messageOf(err) };
  }
}

/** Límite crudo para que el base64 resultante (≈ 4/3) quepa en MAX_COVER_BASE64_LENGTH. */
const MAX_COVER_BYTES = Math.floor((MAX_COVER_BASE64_LENGTH * 3) / 4) - 4;

export async function uploadCoverAction(
  bookId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireWebUser("librarian");
  const file = formData.get("cover");
  if (!(file instanceof File) || file.size === 0) return { error: "Selecciona una imagen" };
  if (file.size > MAX_COVER_BYTES) {
    return { error: `La imagen supera ${Math.round(MAX_COVER_BYTES / 1024)} KB` };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type) return { error: "El archivo debe ser una imagen JPEG, PNG o WebP" };

  try {
    await saveCover(bookId, type, Buffer.from(bytes).toString("base64"));
    revalidatePath(`/books/${bookId}`);
    revalidatePath("/books");
    return { ok: "Portada actualizada" };
  } catch (err) {
    return { error: messageOf(err) };
  }
}
