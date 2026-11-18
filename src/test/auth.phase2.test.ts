/** @vitest-environment node */

import { eq, sql } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST as loginRoute } from "@/app/api/v1/auth/login/route";
import { GET as meRoute } from "@/app/api/v1/auth/me/route";
import { POST as registerRoute } from "@/app/api/v1/auth/register/route";
import { GET as secureProbe } from "@/app/api/v1/admin/secure-probe/route";
import { POST as suspendRoute } from "@/app/api/v1/admin/users/[id]/suspend/route";
import { GET as profileGet, PATCH as profilePatch } from "@/app/api/v1/profiles/me/route";
import { createDb, type Database } from "@/db/client";
import { consentRecords, userRoles } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/crypto";
import { canAccessPath, hasPermission, hasRole, permissionsFor } from "@/lib/auth/rbac";
import {
  loginUser,
  registerUser,
  requestPasswordReset,
  resetPassword,
  resolveSessionFromToken,
  updateOwnProfile,
  verifyEmail,
} from "@/lib/auth/service";
import { SESSION_COOKIE } from "@/lib/auth/session-token";
import { clearSentEmails, getSentEmails } from "@/lib/email";
import { registerSchema } from "@/lib/validation/auth";

const testUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://kingrowellvidal@localhost:5432/propertyfinder_ph_test";

process.env.DATABASE_URL = testUrl;
process.env.AUTH_SECRET =
  process.env.AUTH_SECRET ?? "dev-only-change-me-propertyfinder-ph-auth-secret-32chars";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3456";

let db: Database;

async function resetDb() {
  await db.execute(sql`TRUNCATE TABLE
    listing_reports,
    notifications,
    appointment_status_events,
    appointments,
    inquiry_status_events,
    inquiry_messages,
    inquiries,
    favorites,
    moderation_decisions,
    moderation_cases,
    listing_status_events,
    listing_documents,
    listing_media,
    listing_financing_options,
    listings,
    audit_logs,
    broker_profiles,
    consent_records,
    email_verification_tokens,
    password_reset_tokens,
    sessions,
    user_roles,
    users
    RESTART IDENTITY CASCADE`);
  clearSentEmails();
}

function cookieFrom(response: Response) {
  const header = response.headers.get("set-cookie") ?? "";
  const match = header.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  return match?.[1];
}

describe("RBAC matrix", () => {
  it("assigns portal permissions by role", () => {
    expect(hasRole(["CUSTOMER"], "CUSTOMER")).toBe(true);
    expect(hasPermission(["CUSTOMER"], "portal:admin")).toBe(false);
    expect(hasPermission(["ADMIN"], "admin:suspend_user")).toBe(true);
    expect(canAccessPath(["CUSTOMER"], "/admin")).toBe(false);
    expect(canAccessPath(["ADMIN"], "/admin")).toBe(true);
    expect(canAccessPath(["PROPERTY_OWNER"], "/list")).toBe(true);
    expect(canAccessPath(["REAL_ESTATE_AGENT"], "/agent")).toBe(true);
    expect(permissionsFor(["CUSTOMER", "ADMIN"])).toContain("admin:suspend_user");
  });
});

describe("auth security helpers", () => {
  it("hashes passwords and rejects short passwords", async () => {
    const hash = await hashPassword("SecurePass1!");
    expect(hash).not.toContain("SecurePass1!");
    expect(await verifyPassword("SecurePass1!", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
    expect(
      registerSchema.safeParse({
        email: "a@example.com",
        password: "short",
        fullName: "A B",
        role: "CUSTOMER",
        consent: true,
      }).success,
    ).toBe(false);
  });
});

describe("authentication e2e", () => {
  beforeAll(() => {
    db = createDb(testUrl);
  });

  beforeEach(async () => {
    await resetDb();
  });

  it("registers, verifies email, logs in, and reads the session profile", async () => {
    const registered = await registerUser(
      {
        email: "buyer@example.com",
        password: "SecurePass1!",
        fullName: "Buyer One",
        phone: "+639171234567",
        role: "CUSTOMER",
        consent: true,
      },
      db,
    );
    expect(registered.user.roles).toEqual(["CUSTOMER"]);
    expect(registered.user.emailVerifiedAt).toBeNull();

    const mail = getSentEmails().find((item) => item.subject.includes("Verify"));
    expect(mail?.text).toContain(registered.verifyToken);
    const verified = await verifyEmail({ token: registered.verifyToken }, db);
    expect(verified?.emailVerifiedAt).toBeTruthy();

    const loggedIn = await loginUser({ email: "buyer@example.com", password: "SecurePass1!" }, db);
    const session = await resolveSessionFromToken(loggedIn.session.jwt, db);
    expect(session?.user.email).toBe("buyer@example.com");
  });

  it("supports password recovery without revealing account existence", async () => {
    await registerUser(
      {
        email: "reset@example.com",
        password: "SecurePass1!",
        fullName: "Reset User",
        role: "CUSTOMER",
        consent: true,
      },
      db,
    );
    const missing = await requestPasswordReset({ email: "missing@example.com" }, db);
    expect(missing.accepted).toBe(true);
    const requested = await requestPasswordReset({ email: "reset@example.com" }, db);
    expect(requested.token).toBeTruthy();
    await resetPassword({ token: requested.token!, password: "NewSecurePass1!" }, db);
    await expect(loginUser({ email: "reset@example.com", password: "SecurePass1!" }, db)).rejects.toThrow(
      /Invalid email or password/,
    );
    const again = await loginUser({ email: "reset@example.com", password: "NewSecurePass1!" }, db);
    expect(again.user.email).toBe("reset@example.com");
  });

  it("rejects unauthorized API access and enforces admin-only suspension", async () => {
    const probe = await secureProbe(new Request("http://localhost/api/v1/admin/secure-probe"));
    expect(probe.status).toBe(401);

    const customerResponse = await registerRoute(
      new Request("http://localhost/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "cust@example.com",
          password: "SecurePass1!",
          fullName: "Customer",
          role: "CUSTOMER",
          consent: true,
        }),
      }),
    );
    expect(customerResponse.status).toBe(201);
    const customerCookie = cookieFrom(customerResponse);
    expect(customerCookie).toBeTruthy();

    const forbidden = await secureProbe(
      new Request("http://localhost/api/v1/admin/secure-probe", {
        headers: { cookie: `${SESSION_COOKIE}=${customerCookie}` },
      }),
    );
    expect(forbidden.status).toBe(403);

    const me = await meRoute(
      new Request("http://localhost/api/v1/auth/me", {
        headers: { cookie: `${SESSION_COOKIE}=${customerCookie}` },
      }),
    );
    expect(me.status).toBe(200);

    const admin = await registerUser(
      {
        email: "admin@example.com",
        password: "SecurePass1!",
        fullName: "Admin",
        role: "CUSTOMER",
        consent: true,
      },
      db,
    );
    await db.insert(userRoles).values({ userId: admin.user.id, role: "ADMIN" });
    const adminLogin = await loginUser({ email: "admin@example.com", password: "SecurePass1!" }, db);

    const customer = await resolveSessionFromToken(customerCookie!, db);
    const suspend = await suspendRoute(
      new Request(`http://localhost/api/v1/admin/users/${customer!.user.id}/suspend`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `${SESSION_COOKIE}=${adminLogin.session.jwt}`,
        },
        body: JSON.stringify({ reason: "policy" }),
      }),
      { params: Promise.resolve({ id: customer!.user.id }) },
    );
    expect(suspend.status).toBe(200);

    const blockedLogin = await loginRoute(
      new Request("http://localhost/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "cust@example.com", password: "SecurePass1!" }),
      }),
    );
    expect(blockedLogin.status).toBe(403);
  });

  it("updates profiles and broker fields with authorization checks", async () => {
    const agent = await registerUser(
      {
        email: "agent@example.com",
        password: "SecurePass1!",
        fullName: "Agent Reyes",
        role: "REAL_ESTATE_AGENT",
        consent: true,
      },
      db,
    );
    const updated = await updateOwnProfile(
      agent.user.id,
      {
        fullName: "Agent Maria Reyes",
        activePortal: "REAL_ESTATE_AGENT",
        broker: {
          displayName: "Maria Reyes, REB",
          prcLicenseNo: "PRC-001",
          agencyName: "Reyes Realty",
        },
      },
      db,
    );
    expect(updated?.brokerProfile?.prcLicenseNo).toBe("PRC-001");

    await expect(updateOwnProfile(agent.user.id, { activePortal: "ADMIN" }, db)).rejects.toThrow(/portal/i);

    const profile = await profileGet(
      new Request("http://localhost/api/v1/profiles/me", {
        headers: { cookie: `${SESSION_COOKIE}=${agent.session.jwt}` },
      }),
    );
    expect(profile.status).toBe(200);

    const patch = await profilePatch(
      new Request("http://localhost/api/v1/profiles/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: `${SESSION_COOKIE}=${agent.session.jwt}`,
        },
        body: JSON.stringify({ phone: "+639189998877" }),
      }),
    );
    expect(patch.status).toBe(200);
  });

  it("creates consent and role rows for property owners", async () => {
    const owner = await registerUser(
      {
        email: "owner@example.com",
        password: "SecurePass1!",
        fullName: "Owner Lee",
        role: "PROPERTY_OWNER",
        consent: true,
      },
      db,
    );
    const roles = await db.select().from(userRoles).where(eq(userRoles.userId, owner.user.id));
    const consents = await db.select().from(consentRecords).where(eq(consentRecords.userId, owner.user.id));
    expect(roles.map((row) => row.role)).toEqual(["PROPERTY_OWNER"]);
    expect(consents).toHaveLength(1);
    expect(canAccessPath(owner.user.roles, "/list")).toBe(true);
    expect(canAccessPath(owner.user.roles, "/admin")).toBe(false);
  });
});
