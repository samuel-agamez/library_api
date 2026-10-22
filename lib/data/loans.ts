import "server-only";
import { db } from "../firebase";
import { ApiError } from "../errors";
import { applyAction, assertCanRequest } from "../domain/loan-rules";
import type { AuthUser, Book, Loan, LoanAction, LoanStatus } from "../types";
import { BOOKS } from "./books";

const LOANS = "loans";

const byNewest = (a: Loan, b: Loan) => b.requestedAt.localeCompare(a.requestedAt);

function toLoan(id: string, data: Omit<Loan, "id">): Loan {
  return { id, ...data };
}

/**
 * Crea una solicitud de préstamo de forma idempotente.
 * El id del documento se deriva de (uid, clientRequestId): si la app reenvía la misma
 * solicitud tras perder conexión, se devuelve la ya creada en lugar de duplicarla.
 */
export async function requestLoan(
  user: AuthUser,
  bookId: string,
  clientRequestId: string,
): Promise<{ loan: Loan; created: boolean }> {
  const firestore = db();
  const loanRef = firestore.collection(LOANS).doc(`${user.uid}_${clientRequestId}`);
  const bookRef = firestore.collection(BOOKS).doc(bookId);

  return firestore.runTransaction(async (tx) => {
    const existing = await tx.get(loanRef);
    if (existing.exists) {
      return { loan: toLoan(existing.id, existing.data() as Omit<Loan, "id">), created: false };
    }

    const [bookSnap, mine] = await Promise.all([
      tx.get(bookRef),
      tx.get(firestore.collection(LOANS).where("userId", "==", user.uid)),
    ]);
    if (!bookSnap.exists) throw new ApiError(404, "NOT_FOUND", "Libro no encontrado");
    const book = bookSnap.data() as Book;

    assertCanRequest(
      { id: bookSnap.id, availableCopies: book.availableCopies },
      mine.docs.map((d) => d.data() as Loan),
    );

    const now = new Date().toISOString();
    const data: Omit<Loan, "id"> = {
      bookId,
      bookTitle: book.title,
      userId: user.uid,
      userEmail: user.email,
      userName: user.name,
      status: "requested",
      clientRequestId,
      requestedAt: now,
      resolvedAt: null,
      dueDate: null,
      returnedAt: null,
      updatedAt: now,
    };
    tx.set(loanRef, data);
    return { loan: toLoan(loanRef.id, data), created: true };
  });
}

/** Estudiante: solo sus préstamos. Bibliotecario: todos (con filtro opcional por estado). */
export async function listLoans(user: AuthUser, status?: LoanStatus): Promise<Loan[]> {
  let query: FirebaseFirestore.Query = db().collection(LOANS);
  if (user.role === "student") query = query.where("userId", "==", user.uid);
  else if (status) query = query.where("status", "==", status);

  const snap = await query.get();
  let loans = snap.docs.map((d) => toLoan(d.id, d.data() as Omit<Loan, "id">));
  if (user.role === "student" && status) loans = loans.filter((l) => l.status === status);
  return loans.sort(byNewest);
}

export async function getLoan(user: AuthUser, id: string): Promise<Loan> {
  const snap = await db().collection(LOANS).doc(id).get();
  if (!snap.exists) throw new ApiError(404, "NOT_FOUND", "Préstamo no encontrado");
  const loan = toLoan(snap.id, snap.data() as Omit<Loan, "id">);
  // Un estudiante no debe poder distinguir préstamos ajenos de los inexistentes.
  if (user.role === "student" && loan.userId !== user.uid) {
    throw new ApiError(404, "NOT_FOUND", "Préstamo no encontrado");
  }
  return loan;
}

/** Aprobar / rechazar / devolver: solo bibliotecario (se valida en la ruta). */
export async function transitionLoan(id: string, action: LoanAction): Promise<Loan> {
  const firestore = db();
  const loanRef = firestore.collection(LOANS).doc(id);

  return firestore.runTransaction(async (tx) => {
    const loanSnap = await tx.get(loanRef);
    if (!loanSnap.exists) throw new ApiError(404, "NOT_FOUND", "Préstamo no encontrado");
    const loan = toLoan(loanSnap.id, loanSnap.data() as Omit<Loan, "id">);

    const bookRef = firestore.collection(BOOKS).doc(loan.bookId);
    const bookSnap = await tx.get(bookRef);
    if (!bookSnap.exists) throw new ApiError(404, "NOT_FOUND", "Libro no encontrado");
    const book = bookSnap.data() as Book;

    const now = new Date();
    const result = applyAction(loan, book, action, now);

    tx.update(loanRef, result.loan);
    if (result.copiesDelta !== 0) {
      tx.update(bookRef, {
        availableCopies: book.availableCopies + result.copiesDelta,
        updatedAt: now.toISOString(),
      });
    }
    return { ...loan, ...result.loan };
  });
}
