import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoanActions } from "@/components/loan-controls";
import { StatusBadge, emptyBoxClass, formatDate } from "@/components/ui";
import { listLoans } from "@/lib/data/loans";
import type { Loan } from "@/lib/types";
import { requireWebUser } from "@/lib/web/session";

export const metadata: Metadata = { title: "Préstamos" };

const cardClass =
  "flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 " +
  "sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800";

function actionsFor(loan: Loan): ("approve" | "reject" | "return")[] {
  if (loan.status === "requested") return ["approve", "reject"];
  if (loan.status === "approved") return ["return"];
  return [];
}

async function LoanList() {
  const user = await requireWebUser();
  const loans = await listLoans(user);
  const librarian = user.role === "librarian";

  if (loans.length === 0) {
    return (
      <p className={emptyBoxClass}>
        {librarian ? "Aún no hay solicitudes." : "Todavía no has solicitado libros."}{" "}
        <Link href="/books" className="text-indigo-600 underline">
          Ver catálogo
        </Link>
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {loans.map((loan) => (
        <li key={loan.id} className={cardClass}>
          <div className="flex flex-col gap-1">
            <Link href={`/books/${loan.bookId}`} className="font-semibold hover:underline">
              {loan.bookTitle}
            </Link>
            {librarian && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {loan.userName} · {loan.userEmail}
              </p>
            )}
            <p className="text-xs text-zinc-500">
              Solicitado {formatDate(loan.requestedAt)}
              {loan.status === "approved" && ` · Entrega ${formatDate(loan.dueDate)}`}
              {loan.status === "returned" && ` · Devuelto ${formatDate(loan.returnedAt)}`}
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <StatusBadge status={loan.status} />
            {librarian && actionsFor(loan).length > 0 && (
              <LoanActions loanId={loan.id} actions={actionsFor(loan)} />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function LoansPage() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold">Préstamos</h1>
      <Suspense
        fallback={
          <div className="h-40 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" aria-busy />
        }>
        <LoanList />
      </Suspense>
    </>
  );
}
