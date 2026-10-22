import type { LoanStatus } from "@/lib/types";

export const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 " +
  "outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 " +
  "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

export const buttonClass =
  "inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm " +
  "font-medium text-white transition hover:bg-indigo-700 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryButtonClass =
  "inline-flex items-center justify-center rounded-lg border border-zinc-300 px-3 py-1.5 " +
  "text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 " +
  "dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800";

/** Recuadro de "no hay nada que mostrar" (listas vacías). */
export const emptyBoxClass =
  "rounded-xl border border-dashed border-zinc-300 p-8 text-center text-zinc-500 " +
  "dark:border-zinc-700";

const STATUS: Record<LoanStatus, { label: string; className: string }> = {
  requested: {
    label: "Solicitado",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  },
  approved: {
    label: "Prestado",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  },
  rejected: {
    label: "Rechazado",
    className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  },
  returned: {
    label: "Devuelto",
    className: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  },
};

export function StatusBadge({ status }: { status: LoanStatus }) {
  const { label, className } = STATUS[status];
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>{label}</span>
  );
}

export function Alert({ kind, children }: { kind: "error" | "ok"; children: React.ReactNode }) {
  const styles =
    kind === "error"
      ? "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200"
      : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200";
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={`rounded-lg px-3 py-2 text-sm ${styles}`}>
      {children}
    </p>
  );
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
