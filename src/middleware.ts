import { NextResponse, type NextRequest } from "next/server";
import { canAccessPath, type Role } from "@/lib/auth/rbac";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session-token";

const PROTECTED_PREFIXES = ["/dashboard", "/profile", "/list", "/agent", "/admin"];

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!isProtected(pathname)) {
    return NextResponse.next();
  }

  const nextPath = `${pathname}${request.nextUrl.search}`;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", nextPath);
    return NextResponse.redirect(login);
  }

  const claims = await verifySessionToken(token);
  if (!claims) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", nextPath);
    const response = NextResponse.redirect(login);
    response.cookies.set(SESSION_COOKIE, "", { path: "/", expires: new Date(0) });
    return response;
  }

  if (!canAccessPath(claims.roles as Role[], pathname)) {
    return NextResponse.redirect(new URL("/dashboard?forbidden=1", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/profile",
    "/profile/:path*",
    "/list",
    "/list/:path*",
    "/agent",
    "/agent/:path*",
    "/admin",
    "/admin/:path*",
  ],
};
