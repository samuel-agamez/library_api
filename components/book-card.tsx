import Link from "next/link";
import type { Book } from "@/lib/types";

const placeholderClass =
  "flex items-center justify-center bg-indigo-100 text-4xl font-bold text-indigo-600 " +
  "dark:bg-indigo-950 dark:text-indigo-300";

const cardClass =
  "flex gap-4 rounded-xl border border-zinc-200 p-4 transition " +
  "hover:border-indigo-400 hover:shadow-sm dark:border-zinc-800";

export function BookCover({ book, className = "" }: { book: Book; className?: string }) {
  if (book.coverUrl) {
    // Imagen dinámica servida por la propia API; next/image no aporta aquí.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={book.coverUrl}
        alt={`Portada de ${book.title}`}
        className={`object-cover ${className}`}
      />
    );
  }
  return (
    <div aria-hidden className={`${placeholderClass} ${className}`}>
      {book.title.charAt(0)}
    </div>
  );
}

export function BookCard({ book }: { book: Book }) {
  const available = book.availableCopies > 0;
  return (
    <Link href={`/books/${book.id}`} className={cardClass}>
      <BookCover book={book} className="h-28 w-20 shrink-0 rounded-md" />
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="font-semibold leading-snug">{book.title}</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{book.author}</p>
        <p className="text-xs text-zinc-500">
          {book.category} · {book.year}
        </p>
        <p
          className={`mt-auto text-xs font-medium ${available ? "text-emerald-600" : "text-red-600"}`}>
          {available
            ? `${book.availableCopies} de ${book.totalCopies} disponibles`
            : "Sin ejemplares"}
        </p>
      </div>
    </Link>
  );
}
