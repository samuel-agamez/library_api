import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { getWebUser } from "@/lib/web/session";
import { secondaryButtonClass } from "./ui";

export async function Header() {
  const user = await getWebUser();

  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href={user ? "/books" : "/login"} className="font-semibold tracking-tight">
          📚 Biblioteca
        </Link>
        {user && (
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/books" className="hover:underline">
              Libros
            </Link>
            <Link href="/loans" className="hover:underline">
              {user.role === "librarian" ? "Gestión de préstamos" : "Mis préstamos"}
            </Link>
            <span className="hidden text-zinc-500 sm:inline">
              {user.name} · {user.role === "librarian" ? "Bibliotecario" : "Estudiante"}
            </span>
            <form action={logoutAction}>
              <button className={secondaryButtonClass}>Salir</button>
            </form>
          </nav>
        )}
      </div>
    </header>
  );
}
