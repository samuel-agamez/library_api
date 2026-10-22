import "server-only";
import { db } from "../firebase";
import { ApiError } from "../errors";
import type { Book } from "../types";

export const BOOKS = "books";
export const COVERS = "bookCovers";

type BookDoc = Omit<Book, "id" | "coverUrl"> & { coverVersion?: number };

export function toBook(id: string, data: BookDoc): Book {
  const { coverVersion = 0, ...rest } = data;
  return {
    id,
    ...rest,
    coverUrl: coverVersion > 0 ? `/api/books/${id}/cover?v=${coverVersion}` : null,
  };
}

export interface BookFilter {
  q?: string;
  category?: string;
  updatedSince?: string;
}

const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export async function listBooks(filter: BookFilter = {}): Promise<Book[]> {
  let query: FirebaseFirestore.Query = db().collection(BOOKS);
  // Filtro incremental para la sincronización (semana 11): solo lo que cambió.
  if (filter.updatedSince) query = query.where("updatedAt", ">", filter.updatedSince);
  const snap = await query.get();

  let books = snap.docs.map((d) => toBook(d.id, d.data() as BookDoc));
  if (filter.category) books = books.filter((b) => b.category === filter.category);
  if (filter.q) {
    const q = normalize(filter.q);
    books = books.filter((b) => normalize(`${b.title} ${b.author}`).includes(q));
  }
  return books.sort((a, b) => a.title.localeCompare(b.title, "es"));
}

export async function getBook(id: string): Promise<Book> {
  const snap = await db().collection(BOOKS).doc(id).get();
  if (!snap.exists) throw new ApiError(404, "NOT_FOUND", "Libro no encontrado");
  return toBook(snap.id, snap.data() as BookDoc);
}

export async function listCategories(): Promise<string[]> {
  const books = await listBooks();
  return [...new Set(books.map((b) => b.category))].sort((a, b) => a.localeCompare(b, "es"));
}

export async function saveCover(bookId: string, contentType: string, data: string): Promise<Book> {
  const firestore = db();
  const bookRef = firestore.collection(BOOKS).doc(bookId);
  const coverRef = firestore.collection(COVERS).doc(bookId);

  await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(bookRef);
    if (!snap.exists) throw new ApiError(404, "NOT_FOUND", "Libro no encontrado");
    const current = (snap.data() as BookDoc).coverVersion ?? 0;
    const now = new Date().toISOString();
    tx.set(coverRef, { contentType, data, updatedAt: now });
    // Subir updatedAt hace que el cambio llegue a los clientes en la próxima sincronización.
    tx.update(bookRef, { coverVersion: current + 1, updatedAt: now });
  });
  return getBook(bookId);
}

export async function getCover(bookId: string): Promise<{ contentType: string; bytes: Buffer }> {
  const snap = await db().collection(COVERS).doc(bookId).get();
  if (!snap.exists) throw new ApiError(404, "NOT_FOUND", "El libro no tiene portada");
  const { contentType, data } = snap.data() as { contentType: string; data: string };
  return { contentType, bytes: Buffer.from(data, "base64") };
}
