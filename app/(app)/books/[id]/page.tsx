import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BookCover } from "@/components/book-card";
import { CoverUploadForm, RequestLoanButton } from "@/components/loan-controls";
import { getBook } from "@/lib/data/books";
import { ApiError } from "@/lib/errors";
import { requireWebUser } from "@/lib/web/session";

export const metadata: Metadata = { title: "Detalle del libro" };

async function BookDetail({ params }: { params: PageProps<"/books/[id]">["params"] }) {
  const user = await requireWebUser();
  const { id } = await params;

  const book = await getBook(id).catch((err) => {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  });

  return (
    <article className="grid gap-8 md:grid-cols-[14rem_1fr]">
      <BookCover book={book} className="aspect-[3/4] w-56 rounded-xl" />
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{book.title}</h1>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">{book.author}</p>
        </div>
        <dl className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-zinc-500">Categoría</dt>
            <dd className="font-medium">{book.category}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Año</dt>
            <dd className="font-medium">{book.year}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Disponibles</dt>
            <dd className="font-medium">
              {book.availableCopies} de {book.totalCopies}
            </dd>
          </div>
        </dl>
        <p className="leading-relaxed">{book.description}</p>

        {user.role === "student" ? (
          <RequestLoanButton bookId={book.id} disabled={book.availableCopies <= 0} />
        ) : (
          <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <h2 className="mb-3 font-medium">Administración (bibliotecario)</h2>
            <CoverUploadForm bookId={book.id} />
          </section>
        )}
        <Link href="/books" className="text-sm text-indigo-600 underline">
          ← Volver al catálogo
        </Link>
      </div>
    </article>
  );
}

export default function BookPage(props: PageProps<"/books/[id]">) {
  return (
    <Suspense
      fallback={
        <div className="h-64 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" aria-busy />
      }>
      <BookDetail params={props.params} />
    </Suspense>
  );
}
