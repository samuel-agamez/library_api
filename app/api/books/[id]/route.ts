import { getBook } from "@/lib/data/books";
import { requireUser } from "@/lib/guard";
import { route } from "@/lib/http";

export const GET = route(async (request, ctx: RouteContext<"/api/books/[id]">) => {
  await requireUser(request);
  const { id } = await ctx.params;
  return Response.json({ book: await getBook(id) });
});
