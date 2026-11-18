import { NextResponse } from "next/server";
import { registerUser, SESSION_COOKIE, sessionCookieOptions, toPublicUser } from "@/lib/auth/service";
import { handleRouteError, readJson } from "@/lib/http";
import { registerSchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
  try {
    const body = await readJson(request, registerSchema);
    const result = await registerUser(body);
    const response = NextResponse.json(
      { ok: true, data: { user: toPublicUser(result.user) } },
      { status: 201 },
    );
    response.cookies.set(SESSION_COOKIE, result.session.jwt, sessionCookieOptions(result.session.expiresAt));
    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
