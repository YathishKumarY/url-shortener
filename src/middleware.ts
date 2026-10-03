import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token =
    request.cookies.get("authjs.session-token")?.value ??
    request.cookies.get("__Secure-authjs.session-token")?.value;
  const isAuth = !!token;
  const { pathname } = request.nextUrl;

  const isAuthPage = pathname.startsWith("/auth/signin") || pathname.startsWith("/auth/signup");
  const isHomePage = pathname === "/";

  if ((isAuthPage || isHomePage) && isAuth) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (pathname.startsWith("/dashboard") && !isAuth) {
    return NextResponse.redirect(
      new URL(`/auth/signin?callbackUrl=${encodeURIComponent(pathname)}`, request.url),
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/auth/:path*"],
};
