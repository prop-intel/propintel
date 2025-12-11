import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check for auth session cookie (works in edge runtime without database access)
  // NextAuth v5 uses these cookie names
  const sessionToken =
    request.cookies.get("authjs.session-token")?.value ??
    request.cookies.get("__Secure-authjs.session-token")?.value ??
    request.cookies.get("next-auth.session-token")?.value;

  // Allow forced login with ?force=true query parameter
  const forceLogin = request.nextUrl.searchParams.get("force") === "true";

  // If user has session token and tries to access login page, redirect to dashboard
  // UNLESS force=true is set
  if (pathname === "/login" && sessionToken && !forceLogin) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // If user doesn't have session token and tries to access dashboard, redirect to login
  if (pathname.startsWith("/dashboard") && !sessionToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/dashboard/:path*"],
};
