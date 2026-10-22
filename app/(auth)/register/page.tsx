import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { getWebUser } from "@/lib/web/session";

export const metadata: Metadata = { title: "Crear cuenta" };

async function RedirectIfSignedIn() {
  if (await getWebUser()) redirect("/books");
  return null;
}

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-sm">
      <Suspense>
        <RedirectIfSignedIn />
      </Suspense>
      <h1 className="mb-6 text-2xl font-semibold">Crear cuenta</h1>
      <AuthForm mode="register" />
    </div>
  );
}
