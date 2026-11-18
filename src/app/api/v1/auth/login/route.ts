import { NextResponse } from "next/server";
import { loginUser, SESSION_COOKIE, sessionCookieOptions, toPublicUser } from "@/lib/auth/service";
import { handleRouteError, readJson } from "@/lib/http";
import { loginSchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
  try {
    const body = await readJson(request, loginSchema);
    const result = await loginUser(body);
    const response = NextResponse.json({ ok: true, data: { user: toPublicUser(result.user) } });
    response.cookies.set(SESSION_COOKIE, result.session.jwt, sessionCookieOptions(result.session.expiresAt));
    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
