import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import {
  auditLogs,
  brokerProfiles,
  consentRecords,
  emailVerificationTokens,
  passwordResetTokens,
  sessions,
  userRoles,
  users,
  type UserRole,
} from "@/db/schema";
import type { Database } from "@/db/client";
import { getDb } from "@/db/client";
import { createToken, hashPassword, hashToken, verifyPassword } from "@/lib/auth/crypto";
import {
  AuthenticationError,
  AuthorizationError,
  assertPermission,
  assertRole,
  hasRole,
  type Role,
} from "@/lib/auth/rbac";
import {
  SESSION_COOKIE,
  SESSION_DAYS,
  sessionCookieOptions,
  signSessionToken,
  verifySessionToken,
  type SessionClaims,
} from "@/lib/auth/session-token";
import { sendEmail } from "@/lib/email";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
  verifyEmailSchema,
} from "@/lib/validation/auth";

const TERMS_VERSION = "2026-11-18";
const PRIVACY_VERSION = "2026-11-18";

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  phoneE164: string | null;
  emailVerifiedAt: Date | null;
  status: "active" | "suspended";
  roles: Role[];
  activePortal: Role | null;
  brokerProfile: {
    displayName: string;
    agencyName: string | null;
    prcLicenseNo: string | null;
    dhsudRegistrationNo: string | null;
    bio: string | null;
    licenseReviewStatus: "unreviewed" | "accepted" | "rejected";
  } | null;
};

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function sessionExpiry() {
  return new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
}

async function writeAudit(
  db: Database,
  actorUserId: string | null,
  action: string,
  entityType: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
) {
  await db.insert(auditLogs).values({
    actorUserId,
    action,
    entityType,
    entityId,
    metadata: metadata ? JSON.stringify(metadata) : null,
  });
}

export async function loadAuthUser(db: Database, userId: string): Promise<AuthUser | null> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return null;
  const roles = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
  const [broker] = await db.select().from(brokerProfiles).where(eq(brokerProfiles.userId, userId)).limit(1);
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phoneE164: user.phoneE164,
    emailVerifiedAt: user.emailVerifiedAt,
    status: user.status,
    roles: roles.map((row) => row.role as Role),
    activePortal: (user.activePortal as Role | null) ?? null,
    brokerProfile: broker
      ? {
          displayName: broker.displayName,
          agencyName: broker.agencyName,
          prcLicenseNo: broker.prcLicenseNo,
          dhsudRegistrationNo: broker.dhsudRegistrationNo,
          bio: broker.bio,
          licenseReviewStatus: broker.licenseReviewStatus,
        }
      : null,
  };
}

export async function createSession(db: Database, user: AuthUser) {
  const rawToken = createToken(32);
  const expiresAt = sessionExpiry();
  const [session] = await db
    .insert(sessions)
    .values({
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt,
    })
    .returning();

  const jwt = await signSessionToken(
    {
      sub: user.id,
      sid: session.id,
      roles: user.roles,
      portal: user.activePortal,
      email: user.email,
      name: user.fullName,
    },
    expiresAt,
  );

  return { jwt, expiresAt, sessionId: session.id, rawToken };
}

export async function registerUser(input: unknown, db: Database = getDb()) {
  const data = registerSchema.parse(input);
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, data.email)).limit(1);
  if (existing.length > 0) {
    throw new Error("EMAIL_TAKEN");
  }

  const passwordHash = await hashPassword(data.password);
  const [user] = await db
    .insert(users)
    .values({
      email: data.email,
      passwordHash,
      fullName: data.fullName,
      phoneE164: data.phone || null,
      activePortal: data.role,
    })
    .returning();

  await db.insert(userRoles).values({ userId: user.id, role: data.role });
  await db.insert(consentRecords).values({
    userId: user.id,
    termsVersion: TERMS_VERSION,
    privacyVersion: PRIVACY_VERSION,
  });

  if (data.role === "REAL_ESTATE_AGENT") {
    await db.insert(brokerProfiles).values({
      userId: user.id,
      displayName: data.fullName,
    });
  }

  const verifyToken = createToken(32);
  await db.insert(emailVerificationTokens).values({
    userId: user.id,
    tokenHash: hashToken(verifyToken),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  await sendEmail({
    to: data.email,
    subject: "Verify your PropertyFinder PH email",
    text: `Open ${appUrl()}/verify-email?token=${verifyToken} to verify your email.`,
  });

  await writeAudit(db, user.id, "user.registered", "user", user.id, { role: data.role });

  const authUser = await loadAuthUser(db, user.id);
  if (!authUser) throw new Error("Failed to load user after registration");
  const session = await createSession(db, authUser);
  return { user: authUser, session, verifyToken };
}

export async function loginUser(input: unknown, db: Database = getDb()) {
  const data = loginSchema.parse(input);
  const [user] = await db.select().from(users).where(eq(users.email, data.email)).limit(1);
  if (!user) {
    throw new AuthenticationError("Invalid email or password");
  }
  const valid = await verifyPassword(data.password, user.passwordHash);
  if (!valid) {
    throw new AuthenticationError("Invalid email or password");
  }
  if (user.status === "suspended") {
    throw new AuthorizationError("Account suspended");
  }
  const authUser = await loadAuthUser(db, user.id);
  if (!authUser) throw new AuthenticationError("Invalid email or password");
  const session = await createSession(db, authUser);
  await writeAudit(db, user.id, "user.login", "user", user.id);
  return { user: authUser, session };
}

export async function logoutSession(sessionId: string, db: Database = getDb()) {
  await db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.id, sessionId));
}

export async function requestPasswordReset(input: unknown, db: Database = getDb()) {
  const data = forgotPasswordSchema.parse(input);
  const [user] = await db.select().from(users).where(eq(users.email, data.email)).limit(1);
  if (!user) {
    return { accepted: true as const };
  }
  const token = createToken(32);
  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  await sendEmail({
    to: user.email,
    subject: "Reset your PropertyFinder PH password",
    text: `Open ${appUrl()}/reset-password?token=${token} to choose a new password. This link expires in one hour.`,
  });
  await writeAudit(db, user.id, "user.password_reset_requested", "user", user.id);
  return { accepted: true as const, token };
}

export async function resetPassword(input: unknown, db: Database = getDb()) {
  const data = resetPasswordSchema.parse(input);
  const tokenHash = hashToken(data.token);
  const [row] = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!row) {
    throw new AuthenticationError("Reset link is invalid or expired");
  }
  const passwordHash = await hashPassword(data.password);
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, row.userId));
  await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, row.id));
  await db.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.userId, row.userId), isNull(sessions.revokedAt)));
  await writeAudit(db, row.userId, "user.password_reset", "user", row.userId);
  return { ok: true as const };
}

export async function verifyEmail(input: unknown, db: Database = getDb()) {
  const data = verifyEmailSchema.parse(input);
  const tokenHash = hashToken(data.token);
  const [row] = await db
    .select()
    .from(emailVerificationTokens)
    .where(
      and(
        eq(emailVerificationTokens.tokenHash, tokenHash),
        isNull(emailVerificationTokens.usedAt),
        gt(emailVerificationTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!row) {
    throw new AuthenticationError("Verification link is invalid or expired");
  }
  await db.update(users).set({ emailVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, row.userId));
  await db.update(emailVerificationTokens).set({ usedAt: new Date() }).where(eq(emailVerificationTokens.id, row.id));
  await writeAudit(db, row.userId, "user.email_verified", "user", row.userId);
  return loadAuthUser(db, row.userId);
}

export async function updateOwnProfile(userId: string, input: unknown, db: Database = getDb()) {
  const data = updateProfileSchema.parse(input);
  const user = await loadAuthUser(db, userId);
  if (!user) throw new AuthenticationError();
  if (data.activePortal && !hasRole(user.roles, data.activePortal)) {
    throw new AuthorizationError("Cannot switch to a portal you do not hold");
  }

  const userPatch: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
  if (data.fullName !== undefined) userPatch.fullName = data.fullName;
  if (data.phone !== undefined) userPatch.phoneE164 = data.phone || null;
  if (data.activePortal !== undefined) userPatch.activePortal = data.activePortal;
  await db.update(users).set(userPatch).where(eq(users.id, userId));

  if (data.broker) {
    if (!hasRole(user.roles, "REAL_ESTATE_AGENT")) {
      throw new AuthorizationError("Broker profile requires REAL_ESTATE_AGENT role");
    }
    const [existing] = await db.select().from(brokerProfiles).where(eq(brokerProfiles.userId, userId)).limit(1);
    if (existing) {
      await db
        .update(brokerProfiles)
        .set({
          displayName: data.broker.displayName ?? existing.displayName,
          agencyName: data.broker.agencyName === undefined ? existing.agencyName : data.broker.agencyName || null,
          prcLicenseNo: data.broker.prcLicenseNo === undefined ? existing.prcLicenseNo : data.broker.prcLicenseNo || null,
          dhsudRegistrationNo:
            data.broker.dhsudRegistrationNo === undefined
              ? existing.dhsudRegistrationNo
              : data.broker.dhsudRegistrationNo || null,
          bio: data.broker.bio === undefined ? existing.bio : data.broker.bio || null,
          updatedAt: new Date(),
        })
        .where(eq(brokerProfiles.userId, userId));
    } else {
      await db.insert(brokerProfiles).values({
        userId,
        displayName: data.broker.displayName ?? user.fullName,
        agencyName: data.broker.agencyName || null,
        prcLicenseNo: data.broker.prcLicenseNo || null,
        dhsudRegistrationNo: data.broker.dhsudRegistrationNo || null,
        bio: data.broker.bio || null,
      });
    }
  }

  await writeAudit(db, userId, "profile.updated", "user", userId);
  return loadAuthUser(db, userId);
}

export async function suspendUser(actor: AuthUser, targetUserId: string, reason?: string, db: Database = getDb()) {
  assertPermission(actor.roles, "admin:suspend_user");
  if (actor.id === targetUserId) {
    throw new AuthorizationError("Admins cannot suspend themselves");
  }
  await db.update(users).set({ status: "suspended", updatedAt: new Date() }).where(eq(users.id, targetUserId));
  await db.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.userId, targetUserId), isNull(sessions.revokedAt)));
  await writeAudit(db, actor.id, "user.suspended", "user", targetUserId, { reason });
  return loadAuthUser(db, targetUserId);
}

export async function resolveSessionFromToken(token: string | undefined, db: Database = getDb()): Promise<{
  claims: SessionClaims;
  user: AuthUser;
} | null> {
  if (!token) return null;
  const claims = await verifySessionToken(token);
  if (!claims) return null;
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, claims.sid), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!session) return null;
  const user = await loadAuthUser(db, claims.sub);
  if (!user || user.status !== "active") return null;
  return { claims, user };
}

export async function getSessionFromCookies(db: Database = getDb()) {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  return resolveSessionFromToken(token, db);
}

export async function requireSession(db: Database = getDb()) {
  const session = await getSessionFromCookies(db);
  if (!session) throw new AuthenticationError();
  return session;
}

export async function requireApiSession(request: Request, db: Database = getDb()) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  const token = match?.[1];
  const session = await resolveSessionFromToken(token, db);
  if (!session) throw new AuthenticationError();
  return session;
}

export async function requireApiPermission(request: Request, permission: Parameters<typeof assertPermission>[1], db?: Database) {
  const session = await requireApiSession(request, db);
  assertPermission(session.user.roles, permission);
  return session;
}

export async function requireApiRole(request: Request, role: Role | Role[], db?: Database) {
  const session = await requireApiSession(request, db);
  assertRole(session.user.roles, role);
  return session;
}

export function toPublicUser(user: AuthUser) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phoneE164: user.phoneE164,
    emailVerifiedAt: user.emailVerifiedAt,
    status: user.status,
    roles: user.roles,
    activePortal: user.activePortal,
    brokerProfile: user.brokerProfile,
  };
}

export { SESSION_COOKIE, sessionCookieOptions };
export type { UserRole };
