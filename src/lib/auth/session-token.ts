import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@/lib/auth/rbac";

export const SESSION_COOKIE = "pf_session";
export const SESSION_DAYS = 14;

export type SessionClaims = {
  sub: string;
  sid: string;
  roles: Role[];
  portal: Role | null;
  email: string;
  name: string;
};

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set to at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(claims: SessionClaims, expiresAt: Date): Promise<string> {
  return new SignJWT({
    roles: claims.roles,
    portal: claims.portal,
    email: claims.email,
    name: claims.name,
    sid: claims.sid,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.sid !== "string") return null;
    const roles = Array.isArray(payload.roles) ? (payload.roles as Role[]) : [];
    return {
      sub: payload.sub,
      sid: payload.sid,
      roles,
      portal: (payload.portal as Role | null) ?? null,
      email: typeof payload.email === "string" ? payload.email : "",
      name: typeof payload.name === "string" ? payload.name : "",
    };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}
