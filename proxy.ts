import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "library_session";
const PUBLIC_PATHS = ["/login", "/register"];

/**
 * Comprobación OPTIMISTA: solo mira si existe la cookie para redirigir rápido.
 * La verificación real de la sesión ocurre en lib/web/session.ts (requireWebUser).
 * /api/* queda fuera (ver matcher): ahí la autenticación es por Bearer token.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const isPublic = PUBLIC_PATHS.includes(pathname);

  if (!hasSession && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  // Ojo: no se redirige de /login a /books aquí. Una cookie vencida provocaría un bucle
  // (/books → /login → /books). La página de login valida la sesión y redirige si es válida.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)"],
};
