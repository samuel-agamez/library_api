import { getCover, saveCover } from "@/lib/data/books";
import { assertRole, requireUser } from "@/lib/guard";
import { parseBody, route } from "@/lib/http";
import { ApiError } from "@/lib/errors";
import { sniffImageType } from "@/lib/image";
import { coverSchema } from "@/lib/schemas";

/** Las portadas son públicas (permiten usar <Image uri> sin cabeceras); la URL lleva ?v= para invalidar caché. */
export const GET = route(async (_request, ctx: RouteContext<"/api/books/[id]/cover">) => {
  const { id } = await ctx.params;
  const { contentType, bytes } = await getCover(id);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});

/**
 * PUT /api/books/:id/cover  { contentType, data(base64) }
 * Semana 12: la app envía la foto tomada con la cámara/galería. Solo bibliotecario.
 */
export const PUT = route(async (request, ctx: RouteContext<"/api/books/[id]/cover">) => {
  const user = await requireUser(request);
  assertRole(user, "librarian");
  const { id } = await ctx.params;
  const { contentType, data } = await parseBody(request, coverSchema);
  // No se confía en el Content-Type declarado: se verifica con los bytes reales.
  const real = sniffImageType(Buffer.from(data, "base64"));
  if (real !== contentType) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "El archivo no es una imagen JPEG, PNG o WebP válida",
    );
  }
  console.info(`[cover] ${user.uid} actualizó portada de ${id} (${data.length} chars base64)`);
  return Response.json({ book: await saveCover(id, contentType, data) });
});
