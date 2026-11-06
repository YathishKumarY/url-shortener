import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Request routing that must happen before the filesystem router.
 *
 * Next 16 renamed `middleware` to `proxy`; it runs on the Node.js runtime.
 * Kept free of database access: it only rewrites pretty URLs and gates the
 * dashboard on the presence of a session cookie (the pages and APIs verify
 * the session properly).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /@handle -> link-in-bio page
  if (/^\/@[^/]+$/.test(pathname)) {
    return NextResponse.rewrite(new URL(`/bio/${pathname.slice(2)}`, request.url));
  }

  // /{code}+ -> preview page (like Bitly's "+" and is.gd's "-"): see where a
  // short link goes before visiting it.
  if (/^\/[^/]+\+$/.test(pathname) && pathname.length > 2) {
    return NextResponse.rewrite(new URL(`/preview/${pathname.slice(1, -1)}`, request.url));
  }

  const token =
    request.cookies.get("authjs.session-token")?.value ??
    request.cookies.get("__Secure-authjs.session-token")?.value;
  const isAuthed = !!token;

  const isAuthPage = pathname.startsWith("/auth/signin") || pathname.startsWith("/auth/signup");
  if ((isAuthPage || pathname === "/") && isAuthed) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if ((pathname.startsWith("/dashboard") || pathname.startsWith("/admin")) && !isAuthed) {
    const callbackUrl = encodeURIComponent(pathname + request.nextUrl.search);
    return NextResponse.redirect(new URL(`/auth/signin?callbackUrl=${callbackUrl}`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/admin/:path*",
    "/auth/:path*",
    // Single-segment paths for /@handle and /{code}+ (static files excluded).
    "/((?!api/|_next/|favicon\\.ico|icon\\.svg|apple-icon\\.svg|robots\\.txt|sitemap\\.xml|manifest\\.webmanifest)[^/]+)",
  ],
};
