import { getLoan, transitionLoan } from "@/lib/data/loans";
import { assertRole, requireUser } from "@/lib/guard";
import { parseBody, route } from "@/lib/http";
import { loanActionSchema } from "@/lib/schemas";

export const GET = route(async (request, ctx: RouteContext<"/api/loans/[id]">) => {
  const user = await requireUser(request);
  const { id } = await ctx.params;
  return Response.json({ loan: await getLoan(user, id) });
});

/** PATCH /api/loans/:id  { action: "approve" | "reject" | "return" } — solo bibliotecario. */
export const PATCH = route(async (request, ctx: RouteContext<"/api/loans/[id]">) => {
  const user = await requireUser(request);
  assertRole(user, "librarian");
  const { id } = await ctx.params;
  const { action } = await parseBody(request, loanActionSchema);
  return Response.json({ loan: await transitionLoan(id, action) });
});
