import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: the real authorization happens in src/lib/dal.ts.
const PUBLIC_PATHS = ["/login", "/signup", "/welcome", "/features", "/pricing", "/reviews", "/contact", "/privacy-policy", "/terms", "/forgot-password", "/reset-password", "/verify-email"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has("hearth_session");
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  // Visitors who aren't signed in see the public website's home page at "/".
  if (!hasSession && pathname === "/") return NextResponse.rewrite(new URL("/welcome", request.url));

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
  // Installable-app files (manifest, service worker, offline page, icons) must load without a session.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
