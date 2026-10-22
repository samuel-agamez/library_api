import { ApiError } from "../errors";
import type { Book, Loan, LoanAction } from "../types";

/** Un préstamo "activo" bloquea una nueva solicitud del mismo libro por el mismo usuario. */
const ACTIVE_STATUSES: Loan["status"][] = ["requested", "approved"];

export const LOAN_DAYS = 14;

export function isActive(loan: Pick<Loan, "status">): boolean {
  return ACTIVE_STATUSES.includes(loan.status);
}

/**
 * Valida que el estudiante pueda solicitar el libro.
 * Estos errores 409 son los "conflictos" que la app debe saber resolver cuando
 * una solicitud creada sin conexión llega tarde al servidor (semana 11).
 */
export function assertCanRequest(
  book: Pick<Book, "id" | "availableCopies">,
  userLoans: Pick<Loan, "bookId" | "status">[],
): void {
  if (userLoans.some((l) => l.bookId === book.id && isActive(l))) {
    throw new ApiError(
      409,
      "ALREADY_ACTIVE",
      "Ya tienes una solicitud o préstamo activo de este libro",
    );
  }
  if (book.availableCopies <= 0) {
    throw new ApiError(409, "NO_COPIES", "No hay ejemplares disponibles");
  }
}

export interface Transition {
  loan: Pick<Loan, "status" | "resolvedAt" | "dueDate" | "returnedAt" | "updatedAt">;
  /** Cambio en ejemplares disponibles del libro: -1 al prestar, +1 al devolver. */
  copiesDelta: -1 | 0 | 1;
}

/** Máquina de estados: requested → approved → returned, o requested → rejected. */
export function applyAction(
  loan: Pick<Loan, "status" | "dueDate">,
  book: Pick<Book, "availableCopies" | "totalCopies">,
  action: LoanAction,
  now: Date,
): Transition {
  const iso = now.toISOString();

  if (action === "approve") {
    if (loan.status !== "requested") {
      throw new ApiError(409, "INVALID_STATE", "Solo se puede aprobar una solicitud pendiente");
    }
    if (book.availableCopies <= 0) {
      throw new ApiError(409, "NO_COPIES", "No hay ejemplares disponibles para prestar");
    }
    const due = new Date(now.getTime() + LOAN_DAYS * 24 * 60 * 60 * 1000);
    return {
      loan: {
        status: "approved",
        resolvedAt: iso,
        dueDate: due.toISOString(),
        returnedAt: null,
        updatedAt: iso,
      },
      copiesDelta: -1,
    };
  }

  if (action === "reject") {
    if (loan.status !== "requested") {
      throw new ApiError(409, "INVALID_STATE", "Solo se puede rechazar una solicitud pendiente");
    }
    return {
      loan: {
        status: "rejected",
        resolvedAt: iso,
        dueDate: loan.dueDate,
        returnedAt: null,
        updatedAt: iso,
      },
      copiesDelta: 0,
    };
  }

  if (loan.status !== "approved") {
    throw new ApiError(409, "INVALID_STATE", "Solo se puede devolver un préstamo aprobado");
  }
  return {
    loan: {
      status: "returned",
      resolvedAt: iso,
      dueDate: loan.dueDate,
      returnedAt: iso,
      updatedAt: iso,
    },
    copiesDelta: book.availableCopies < book.totalCopies ? 1 : 0,
  };
}
