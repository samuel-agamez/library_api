export type Role = "student" | "librarian";

export interface AuthUser {
  uid: string;
  email: string;
  name: string;
  role: Role;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  category: string;
  year: number;
  description: string;
  totalCopies: number;
  availableCopies: number;
  /** Ruta relativa a la API (ej. /api/books/abc/cover?v=2) o null si no hay portada. */
  coverUrl: string | null;
  /** ISO 8601. Se usa como cursor para la sincronización incremental (?updatedSince=). */
  updatedAt: string;
}

export type LoanStatus = "requested" | "approved" | "rejected" | "returned";

export interface Loan {
  id: string;
  bookId: string;
  bookTitle: string;
  userId: string;
  userEmail: string;
  userName: string;
  status: LoanStatus;
  /** Llave de idempotencia generada por el cliente (semana 11: cola offline). */
  clientRequestId: string;
  requestedAt: string;
  resolvedAt: string | null;
  dueDate: string | null;
  returnedAt: string | null;
  updatedAt: string;
}

export type LoanAction = "approve" | "reject" | "return";

export interface TokenSet {
  idToken: string;
  refreshToken: string;
  /** Segundos de vigencia del idToken. */
  expiresIn: number;
}
