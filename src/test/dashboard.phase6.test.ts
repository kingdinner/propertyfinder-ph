/** @vitest-environment node */

import { sql } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GET as customerDashboard } from "@/app/api/v1/dashboard/customer/route";
import { GET as agentDashboard } from "@/app/api/v1/dashboard/agent/route";
import { GET as adminDashboard } from "@/app/api/v1/dashboard/admin/route";
import { POST as createReport } from "@/app/api/v1/reports/route";
import { createDb, type Database } from "@/db/client";
import { favorites, listings } from "@/db/schema";
import { loginUser, registerUser, verifyEmail } from "@/lib/auth/service";
import { SESSION_COOKIE } from "@/lib/auth/session-token";
import { getAdminDashboard, getAgentDashboard, getCustomerDashboard } from "@/lib/dashboard/service";
import { clearSentEmails } from "@/lib/email";

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

async function verified(email: string, role: "CUSTOMER" | "PROPERTY_OWNER" | "REAL_ESTATE_AGENT") {
  const registered = await registerUser(
    {
      email,
      password: "SecurePass1!",
      fullName: email.split("@")[0]!,
      role,
      consent: true,
    },
    db,
  );
  await verifyEmail({ token: registered.verifyToken }, db);
  return loginUser({ email, password: "SecurePass1!" }, db);
}

async function seedAdmin() {
  const { hashPassword } = await import("@/lib/auth/crypto");
  const { users, userRoles } = await import("@/db/schema");
  const passwordHash = await hashPassword("ChangeMeAdmin1!");
  const [admin] = await db
    .insert(users)
    .values({
      email: "admin-dash@propertyfinder.ph",
      passwordHash,
      fullName: "Admin Dash",
      emailVerifiedAt: new Date(),
      status: "active",
      activePortal: "ADMIN",
    })
    .returning();
  await db.insert(userRoles).values({ userId: admin.id, role: "ADMIN" });
  return loginUser({ email: "admin-dash@propertyfinder.ph", password: "ChangeMeAdmin1!" }, db);
}

describe("dashboard services and authorization", () => {
  beforeAll(() => {
    db = createDb(testUrl);
  });

  beforeEach(async () => {
    await resetDb();
  });

  it("returns real customer counts, pagination, and empty lists", async () => {
    const buyer = await verified("dash-buyer@example.com", "CUSTOMER");
    const owner = await verified("dash-owner@example.com", "PROPERTY_OWNER");
    const empty = await getCustomerDashboard(buyer.user, { tab: "favorites", page: 1, pageSize: 5 }, db);
    expect(empty.summary.favorites).toBe(0);
    expect(empty.list.items).toEqual([]);
    expect(empty.list.totalPages).toBe(1);

    const created = [];
    for (let index = 0; index < 3; index += 1) {
      const [listing] = await db
        .insert(listings)
        .values({
          publicCode: `PF-DASH-${index}`,
          ownerUserId: owner.user.id,
          transaction: index === 2 ? "rent" : "sale",
          category: "condo",
          title: `Dashboard listing ${index}`,
          description: "Published listing for customer dashboard pagination coverage.",
          pricePhpCentavos: 5_000_000_00 + index,
          province: "Metro Manila",
          city: "Makati",
          barangay: "Poblacion",
          status: "published",
          publishedAt: new Date(),
          bedrooms: 1,
          bathrooms: 1,
          floorAreaSqm: "40",
        })
        .returning();
      created.push(listing);
      await db.insert(favorites).values({ userId: buyer.user.id, listingId: listing.id });
    }

    const page1 = await getCustomerDashboard(
      buyer.user,
      { tab: "favorites", page: 1, pageSize: 2, transaction: "sale" },
      db,
    );
    expect(page1.summary.favorites).toBe(3);
    expect(page1.list.items).toHaveLength(2);
    expect(page1.list.total).toBe(2);
    expect(page1.list.totalPages).toBe(1);

    const profile = await getCustomerDashboard(buyer.user, { tab: "profile" }, db);
    expect(profile.profile?.email).toBe("dash-buyer@example.com");
  });

  it("scopes agent dashboard to owned/assigned listings only", async () => {
    const owner = await verified("agent-dash-owner@example.com", "PROPERTY_OWNER");
    const other = await verified("agent-dash-other@example.com", "PROPERTY_OWNER");
    await db.insert(listings).values({
      publicCode: "PF-OWN",
      ownerUserId: owner.user.id,
      transaction: "sale",
      category: "house_lot",
      title: "Owner listing",
      description: "Owned listing should appear in agent dashboard counts.",
      pricePhpCentavos: 8_000_000_00,
      province: "Batangas",
      city: "Lipa City",
      barangay: "San Sebastian",
      status: "published",
      publishedAt: new Date(),
    });
    await db.insert(listings).values({
      publicCode: "PF-OTHER",
      ownerUserId: other.user.id,
      transaction: "sale",
      category: "house_lot",
      title: "Other listing",
      description: "Foreign listing must not appear in another owner's dashboard.",
      pricePhpCentavos: 8_000_000_00,
      province: "Batangas",
      city: "Lipa City",
      barangay: "San Sebastian",
      status: "published",
      publishedAt: new Date(),
    });

    const dashboard = await getAgentDashboard(owner.user, { tab: "listings", page: 1, pageSize: 10 }, db);
    expect(dashboard.summary.listingsTotal).toBe(1);
    expect(dashboard.list.items).toHaveLength(1);
    expect((dashboard.list.items[0] as { publicCode: string }).publicCode).toBe("PF-OWN");
  });

  it("requires admin auth and exposes analytics plus reports workflow", async () => {
    const buyer = await verified("report-buyer@example.com", "CUSTOMER");
    const owner = await verified("report-owner@example.com", "PROPERTY_OWNER");
    const admin = await seedAdmin();
    const [listing] = await db
      .insert(listings)
      .values({
        publicCode: "PF-REP",
        ownerUserId: owner.user.id,
        transaction: "sale",
        category: "condo",
        title: "Reported condo",
        description: "Published listing used for admin report dashboard coverage.",
        pricePhpCentavos: 7_000_000_00,
        province: "Metro Manila",
        city: "Taguig",
        barangay: "Fort Bonifacio",
        status: "published",
        publishedAt: new Date(),
      })
      .returning();

    const forbidden = await adminDashboard(
      new Request("http://localhost/api/v1/dashboard/admin?tab=analytics"),
    );
    expect(forbidden.status).toBe(401);

    const customerBlocked = await adminDashboard(
      new Request("http://localhost/api/v1/dashboard/admin?tab=analytics", {
        headers: { cookie: `${SESSION_COOKIE}=${buyer.session.jwt}` },
      }),
    );
    expect(customerBlocked.status).toBe(403);

    const reported = await createReport(
      new Request("http://localhost/api/v1/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `${SESSION_COOKIE}=${buyer.session.jwt}`,
        },
        body: JSON.stringify({ listingId: listing.id, reason: "Misleading photos" }),
      }),
    );
    expect(reported.status).toBe(201);

    const analytics = await getAdminDashboard(admin.user, { tab: "analytics" }, db);
    expect(analytics.summary.publishedListings).toBe(1);
    expect(analytics.summary.openReports).toBe(1);
    expect(analytics.analytics?.listings.published).toBe(1);

    const reports = await getAdminDashboard(admin.user, { tab: "reports", reportStatus: "open" }, db);
    expect(reports.list.total).toBe(1);

    const ok = await adminDashboard(
      new Request("http://localhost/api/v1/dashboard/admin?tab=users&page=1", {
        headers: { cookie: `${SESSION_COOKIE}=${admin.session.jwt}` },
      }),
    );
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(body.data.list.total).toBeGreaterThanOrEqual(3);

    const customerOk = await customerDashboard(
      new Request("http://localhost/api/v1/dashboard/customer?tab=favorites", {
        headers: { cookie: `${SESSION_COOKIE}=${buyer.session.jwt}` },
      }),
    );
    expect(customerOk.status).toBe(200);

    const agentOk = await agentDashboard(
      new Request("http://localhost/api/v1/dashboard/agent?tab=listings", {
        headers: { cookie: `${SESSION_COOKIE}=${owner.session.jwt}` },
      }),
    );
    expect(agentOk.status).toBe(200);
  });
});
