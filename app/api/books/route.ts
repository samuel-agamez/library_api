import { listBooks, listCategories } from "@/lib/data/books";
import { requireUser } from "@/lib/guard";
import { parseQuery, route } from "@/lib/http";
import { bookQuerySchema } from "@/lib/schemas";

/**
 * GET /api/books?q=&category=&updatedSince=
 * `updatedSince` (ISO) devuelve solo los libros modificados desde esa fecha:
 * es el cursor de la sincronización incremental de la app (semana 11).
 * `serverTime` se toma ANTES de consultar para no perder cambios concurrentes.
 */
export const GET = route(async (request) => {
  await requireUser(request);
  const filter = parseQuery(request, bookQuerySchema);
  const serverTime = new Date().toISOString();
  const [books, categories] = await Promise.all([listBooks(filter), listCategories()]);
  return Response.json({ books, categories, serverTime });
});
