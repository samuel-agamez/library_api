import type { Metadata } from "next";
import { Suspense } from "react";
import { BookCard } from "@/components/book-card";
import { buttonClass, emptyBoxClass, inputClass } from "@/components/ui";
import { listBooks, listCategories } from "@/lib/data/books";
import { requireWebUser } from "@/lib/web/session";

export const metadata: Metadata = { title: "Libros" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function BookList({ searchParams }: { searchParams: PageProps<"/books">["searchParams"] }) {
  await requireWebUser();
  const params = await searchParams;
  const q = first(params.q)?.trim().slice(0, 100) || undefined;
  const category = first(params.category)?.trim().slice(0, 60) || undefined;

  const [books, categories] = await Promise.all([listBooks({ q, category }), listCategories()]);

  return (
    <>
      <form className="mb-6 flex flex-col gap-3 sm:flex-row" role="search">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por título o autor"
          className={inputClass}
          aria-label="Buscar"
        />
        <select
          name="category"
          defaultValue={category ?? ""}
          className={`${inputClass} sm:w-48`}
          aria-label="Categoría">
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button className={buttonClass}>Buscar</button>
      </form>

      {books.length === 0 ? (
        <p className={emptyBoxClass}>No encontramos libros con esos criterios.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {books.map((b) => (
            <li key={b.id}>
              <BookCard book={b} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Skeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2" aria-busy>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="h-36 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />
      ))}
    </div>
  );
}

export default function BooksPage(props: PageProps<"/books">) {
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold">Catálogo de libros</h1>
      <Suspense fallback={<Skeleton />}>
        <BookList searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
