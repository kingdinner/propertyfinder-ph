/** @vitest-environment node */

import { eq, sql } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST as createListingRoute, GET as listListingsRoute } from "@/app/api/v1/listings/route";
import { POST as submitRoute } from "@/app/api/v1/listings/[id]/submit/route";
import { POST as resubmitRoute } from "@/app/api/v1/listings/[id]/resubmit/route";
import { POST as archiveRoute } from "@/app/api/v1/listings/[id]/archive/route";
import { POST as mediaRoute } from "@/app/api/v1/listings/[id]/media/route";
import { POST as decideRoute } from "@/app/api/v1/admin/moderation/[id]/decide/route";
import { GET as moderationRoute } from "@/app/api/v1/admin/moderation/route";
import { createDb, type Database } from "@/db/client";
import { listings, userRoles, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth/crypto";
import { assertTransition, allowedFrom } from "@/lib/listings/lifecycle";
import {
  addListingImage,
  archiveListing,
  assignBroker,
  createDraftListing,
  decideModeration,
  submitListing,
  updateListingDraft,
} from "@/lib/listings/service";
import { loginUser, registerUser, verifyEmail } from "@/lib/auth/service";
import { SESSION_COOKIE } from "@/lib/auth/session-token";
import { listingDraftSchema, listingSubmitSchema } from "@/lib/validation/listings";
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

async function createVerifiedOwner(email = "owner@example.com") {
  const registered = await registerUser(
    {
      email,
      password: "SecurePass1!",
      fullName: "Owner One",
      phone: "+639171111111",
      role: "PROPERTY_OWNER",
      consent: true,
    },
    db,
  );
  await verifyEmail({ token: registered.verifyToken }, db);
  const loggedIn = await loginUser({ email, password: "SecurePass1!" }, db);
  return { user: loggedIn.user, jwt: loggedIn.session.jwt };
}

async function createVerifiedAdmin() {
  const passwordHash = await hashPassword("ChangeMeAdmin1!");
  const [admin] = await db
    .insert(users)
    .values({
      email: "admin@propertyfinder.ph",
      passwordHash,
      fullName: "Admin",
      emailVerifiedAt: new Date(),
      status: "active",
      activePortal: "ADMIN",
    })
    .returning();
  await db.insert(userRoles).values({ userId: admin.id, role: "ADMIN" });
  const loggedIn = await loginUser({ email: "admin@propertyfinder.ph", password: "ChangeMeAdmin1!" }, db);
  return { user: loggedIn.user, jwt: loggedIn.session.jwt };
}

function validDraft(overrides: Record<string, unknown> = {}) {
  return {
    transaction: "sale",
    category: "house_lot",
    title: "Modern Lipa villa with garden",
    description: "A spacious house and lot in Lipa City with parking and a private garden for the family.",
    constructionStatus: "resale",
    furnishing: "semi_furnished",
    bedrooms: 4,
    bathrooms: 3,
    powderRooms: 1,
    parkingSlots: 2,
    floorAreaSqm: 220,
    lotAreaSqm: 450,
    declaredTitleStatus: "clean_tct_cct",
    pricePhpCentavos: 1_480_000_000,
    priceNegotiable: true,
    province: "Batangas",
    city: "Lipa City",
    barangay: "San Sebastian",
    postalCode: "4217",
    subdivision: "Malarayat Hills",
    streetAddress: "Lot 12 Block 3",
    financingOptions: ["cash", "bank"],
    ...overrides,
  };
}

async function tinyPngFile() {
  // 1x1 PNG
  const bytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  return new File([bytes], "photo.png", { type: "image/png" });
}

describe("listing validation rules", () => {
  it("requires financing for sale submissions and forbids it for rent", () => {
    expect(listingDraftSchema.safeParse(validDraft({ financingOptions: [] })).success).toBe(true);
    expect(listingSubmitSchema.safeParse(validDraft({ financingOptions: [] })).success).toBe(false);
    expect(
      listingSubmitSchema.safeParse(
        validDraft({
          transaction: "rent",
          financingOptions: ["cash"],
          pricePhpCentavos: 5_000_000,
        }),
      ).success,
    ).toBe(false);
    expect(
      listingSubmitSchema.safeParse(
        validDraft({
          transaction: "rent",
          financingOptions: [],
          pricePhpCentavos: 5_000_000,
        }),
      ).success,
    ).toBe(true);
  });

  it("applies category-dependent required fields on submit", () => {
    expect(
      listingSubmitSchema.safeParse(validDraft({ category: "lot", floorAreaSqm: null, bedrooms: 0 })).success,
    ).toBe(true);
    expect(
      listingSubmitSchema.safeParse(
        validDraft({ category: "condo", lotAreaSqm: null, bedrooms: 2, floorAreaSqm: 90 }),
      ).success,
    ).toBe(true);
    expect(
      listingSubmitSchema.safeParse(validDraft({ category: "house_lot", lotAreaSqm: null })).success,
    ).toBe(false);
  });
});

describe("listing lifecycle matrix", () => {
  it("documents allowed transitions for every status", () => {
    expect(allowedFrom("draft").sort()).toEqual(["archive", "save_draft", "submit"].sort());
    expect(allowedFrom("pending_review").sort()).toEqual(
      ["approve", "archive", "reject", "request_changes"].sort(),
    );
    expect(allowedFrom("needs_revision").sort()).toEqual(["archive", "resubmit", "save_draft"].sort());
    expect(allowedFrom("rejected").sort()).toEqual(["archive", "resubmit", "save_draft"].sort());
    expect(allowedFrom("published").sort()).toEqual(["archive"].sort());
    expect(allowedFrom("archived")).toEqual([]);
    expect(assertTransition("draft", "submit")).toBe("pending_review");
    expect(assertTransition("pending_review", "approve")).toBe("published");
    expect(assertTransition("pending_review", "request_changes")).toBe("needs_revision");
    expect(assertTransition("pending_review", "reject")).toBe("rejected");
    expect(assertTransition("needs_revision", "resubmit")).toBe("pending_review");
    expect(assertTransition("rejected", "resubmit")).toBe("pending_review");
    expect(() => assertTransition("published", "submit")).toThrow();
    expect(() => assertTransition("archived", "archive")).toThrow();
  });
});

describe("listing management e2e", () => {
  beforeAll(() => {
    db = createDb(testUrl);
  });

  beforeEach(async () => {
    await resetDb();
  });

  it("runs draft → submit → approve → archive with persistence", async () => {
    const owner = await createVerifiedOwner();
    const admin = await createVerifiedAdmin();

    const draft = await createDraftListing(owner.user, validDraft(), db);
    expect(draft.status).toBe("draft");
    expect(draft.publicCode).toMatch(/^PF-/);
    expect(draft.financingOptions).toEqual(["cash", "bank"]);

    await addListingImage(owner.user, draft.id, await tinyPngFile(), db);
    const submitted = await submitListing(owner.user, draft.id, undefined, "submit", db);
    expect(submitted.status).toBe("pending_review");

    const [row] = await db.select().from(listings).where(eq(listings.id, draft.id));
    expect(row.status).toBe("pending_review");

    const published = await decideModeration(
      admin.user,
      draft.id,
      { outcome: "approve", noteToLister: "Looks complete" },
      db,
    );
    expect(published.status).toBe("published");
    expect(published.publishedAt).toBeTruthy();

    const archived = await archiveListing(owner.user, draft.id, db);
    expect(archived.status).toBe("archived");
  });

  it("supports request changes, edit, reject, and resubmit", async () => {
    const owner = await createVerifiedOwner();
    const admin = await createVerifiedAdmin();
    const draft = await createDraftListing(owner.user, validDraft(), db);
    await addListingImage(owner.user, draft.id, await tinyPngFile(), db);
    await submitListing(owner.user, draft.id, undefined, "submit", db);

    const needsRevision = await decideModeration(
      admin.user,
      draft.id,
      { outcome: "request_changes", noteToLister: "Add clearer lot boundaries" },
      db,
    );
    expect(needsRevision.status).toBe("needs_revision");
    expect(needsRevision.moderationNote).toContain("lot boundaries");

    await updateListingDraft(
      owner.user,
      draft.id,
      validDraft({ description: "Updated description with clearer lot boundaries for Lipa property." }),
      db,
    );
    await addListingImage(owner.user, draft.id, await tinyPngFile(), db);
    const resubmitted = await submitListing(owner.user, draft.id, undefined, "resubmit", db);
    expect(resubmitted.status).toBe("pending_review");

    const rejected = await decideModeration(
      admin.user,
      draft.id,
      { outcome: "reject", noteToLister: "Documents incomplete" },
      db,
    );
    expect(rejected.status).toBe("rejected");

    const again = await submitListing(owner.user, draft.id, undefined, "resubmit", db);
    expect(again.status).toBe("pending_review");
  });

  it("enforces ownership and agent assignment permissions", async () => {
    const owner = await createVerifiedOwner("owner-a@example.com");
    const other = await createVerifiedOwner("owner-b@example.com");
    const agentRegistered = await registerUser(
      {
        email: "agent@example.com",
        password: "SecurePass1!",
        fullName: "Agent One",
        role: "REAL_ESTATE_AGENT",
        consent: true,
      },
      db,
    );
    await verifyEmail({ token: agentRegistered.verifyToken }, db);
    const agent = await loginUser({ email: "agent@example.com", password: "SecurePass1!" }, db);

    const draft = await createDraftListing(owner.user, validDraft(), db);

    await expect(updateListingDraft(other.user, draft.id, validDraft(), db)).rejects.toThrow(/own or manage/i);

    const assigned = await assignBroker(owner.user, draft.id, { brokerUserId: agent.user.id }, db);
    expect(assigned.brokerUserId).toBe(agent.user.id);

    const byAgent = await updateListingDraft(
      agent.user,
      draft.id,
      validDraft({ title: "Agent updated Lipa villa listing" }),
      db,
    );
    expect(byAgent.title).toContain("Agent updated");
  });

  it("rejects unauthenticated listing API calls and customers without listing permission", async () => {
    const unauth = await listListingsRoute(new Request("http://localhost/api/v1/listings"));
    expect(unauth.status).toBe(401);

    const customer = await registerUser(
      {
        email: "buyer@example.com",
        password: "SecurePass1!",
        fullName: "Buyer",
        role: "CUSTOMER",
        consent: true,
      },
      db,
    );
    await verifyEmail({ token: customer.verifyToken }, db);
    const loggedIn = await loginUser({ email: "buyer@example.com", password: "SecurePass1!" }, db);
    const forbidden = await createListingRoute(
      new Request("http://localhost/api/v1/listings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `${SESSION_COOKIE}=${loggedIn.session.jwt}`,
        },
        body: JSON.stringify(validDraft()),
      }),
    );
    expect(forbidden.status).toBe(403);
  });

  it("covers API lifecycle transitions including media upload", async () => {
    const owner = await createVerifiedOwner();
    const admin = await createVerifiedAdmin();

    const created = await createListingRoute(
      new Request("http://localhost/api/v1/listings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `${SESSION_COOKIE}=${owner.jwt}`,
        },
        body: JSON.stringify(validDraft()),
      }),
    );
    expect(created.status).toBe(201);
    const createdBody = await created.json();
    const listingId = createdBody.data.listing.id as string;

    const form = new FormData();
    form.set("file", await tinyPngFile());
    const uploaded = await mediaRoute(
      new Request(`http://localhost/api/v1/listings/${listingId}/media`, {
        method: "POST",
        headers: { cookie: `${SESSION_COOKIE}=${owner.jwt}` },
        body: form,
      }),
      { params: Promise.resolve({ id: listingId }) },
    );
    expect(uploaded.status).toBe(200);

    const submitted = await submitRoute(
      new Request(`http://localhost/api/v1/listings/${listingId}/submit`, {
        method: "POST",
        headers: { cookie: `${SESSION_COOKIE}=${owner.jwt}` },
      }),
      { params: Promise.resolve({ id: listingId }) },
    );
    expect(submitted.status).toBe(200);

    const queue = await moderationRoute(
      new Request("http://localhost/api/v1/admin/moderation", {
        headers: { cookie: `${SESSION_COOKIE}=${admin.jwt}` },
      }),
    );
    expect(queue.status).toBe(200);
    const queueBody = await queue.json();
    expect(queueBody.data.queue.length).toBe(1);

    const changes = await decideRoute(
      new Request(`http://localhost/api/v1/admin/moderation/${listingId}/decide`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `${SESSION_COOKIE}=${admin.jwt}`,
        },
        body: JSON.stringify({ outcome: "request_changes", noteToLister: "Need another photo" }),
      }),
      { params: Promise.resolve({ id: listingId }) },
    );
    expect(changes.status).toBe(200);

    const resubmitted = await resubmitRoute(
      new Request(`http://localhost/api/v1/listings/${listingId}/resubmit`, {
        method: "POST",
        headers: { cookie: `${SESSION_COOKIE}=${owner.jwt}` },
      }),
      { params: Promise.resolve({ id: listingId }) },
    );
    expect(resubmitted.status).toBe(200);

    const approved = await decideRoute(
      new Request(`http://localhost/api/v1/admin/moderation/${listingId}/decide`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `${SESSION_COOKIE}=${admin.jwt}`,
        },
        body: JSON.stringify({ outcome: "approve" }),
      }),
      { params: Promise.resolve({ id: listingId }) },
    );
    expect(approved.status).toBe(200);

    const archived = await archiveRoute(
      new Request(`http://localhost/api/v1/listings/${listingId}/archive`, {
        method: "POST",
        headers: { cookie: `${SESSION_COOKIE}=${owner.jwt}` },
      }),
      { params: Promise.resolve({ id: listingId }) },
    );
    expect(archived.status).toBe(200);
    const archivedBody = await archived.json();
    expect(archivedBody.data.listing.status).toBe("archived");
  });
});
