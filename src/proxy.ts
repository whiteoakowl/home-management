import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: the real authorization happens in src/lib/dal.ts.
const PUBLIC_PATHS = ["/login", "/signup"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has("hearth_session");
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!hasSession && !isPublic) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  // Signed-in users on /login are redirected by the page itself after the
  // session is verified (a stale cookie must not cause a redirect loop).
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
