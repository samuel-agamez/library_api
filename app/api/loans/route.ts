import { listLoans, requestLoan } from "@/lib/data/loans";
import { assertRole, requireUser } from "@/lib/guard";
import { parseBody, parseQuery, route } from "@/lib/http";
import { createLoanSchema, loanQuerySchema } from "@/lib/schemas";

/** Estudiante: sus préstamos. Bibliotecario: todos. */
export const GET = route(async (request) => {
  const user = await requireUser(request);
  const { status } = parseQuery(request, loanQuerySchema);
  const serverTime = new Date().toISOString();
  return Response.json({ loans: await listLoans(user, status), serverTime });
});

/**
 * POST /api/loans  { bookId, clientRequestId }
 * Idempotente por clientRequestId: 201 si se creó, 200 si ya existía (reintento de la cola offline).
 * 409 ALREADY_ACTIVE / NO_COPIES son los conflictos que la app resuelve "gana el servidor".
 */
export const POST = route(async (request) => {
  const user = await requireUser(request);
  assertRole(user, "student");
  const { bookId, clientRequestId } = await parseBody(request, createLoanSchema);
  const { loan, created } = await requestLoan(user, bookId, clientRequestId);
  return Response.json({ loan }, { status: created ? 201 : 200 });
});
