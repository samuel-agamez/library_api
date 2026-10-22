"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, registerAction, type FormState } from "@/app/actions";
import { Alert, buttonClass, inputClass } from "./ui";

const initial: FormState = {};

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [state, action, pending] = useActionState(
    mode === "login" ? loginAction : registerAction,
    initial,
  );
  const isLogin = mode === "login";

  return (
    <form action={action} className="flex flex-col gap-4">
      {!isLogin && (
        <label className="flex flex-col gap-1 text-sm font-medium">
          Nombre
          <input
            name="displayName"
            required
            minLength={2}
            autoComplete="name"
            className={inputClass}
          />
        </label>
      )}
      <label className="flex flex-col gap-1 text-sm font-medium">
        Correo
        <input name="email" type="email" required autoComplete="email" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Contraseña
        <input
          name="password"
          type="password"
          required
          minLength={isLogin ? 1 : 6}
          autoComplete={isLogin ? "current-password" : "new-password"}
          className={inputClass}
        />
      </label>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Procesando…" : isLogin ? "Iniciar sesión" : "Crear cuenta de estudiante"}
      </button>
      <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
        {isLogin ? (
          <>
            ¿No tienes cuenta?{" "}
            <Link href="/register" className="text-indigo-600 underline">
              Regístrate
            </Link>
          </>
        ) : (
          <>
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" className="text-indigo-600 underline">
              Inicia sesión
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
