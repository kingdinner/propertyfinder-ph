/** @vitest-environment node */

import { sql } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GET as searchRoute } from "@/app/api/v1/search/route";
import { GET as publicListingRoute } from "@/app/api/v1/public/listings/[id]/route";
import { DELETE as favoritesDelete, GET as favoritesGet, POST as favoritesPost } from "@/app/api/v1/favorites/route";
import { createDb, type Database } from "@/db/client";
import { listingMedia, listings } from "@/db/schema";
import { loginUser, registerUser, verifyEmail } from "@/lib/auth/service";
import { SESSION_COOKIE } from "@/lib/auth/session-token";
import { addFavorite, listFavorites } from "@/lib/favorites/service";
import { getPublishedListing, searchPublishedListings } from "@/lib/search/service";
import { parseSearchParams, searchQuerySchema } from "@/lib/validation/search";
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

async function seedOwner() {
  const registered = await registerUser(
    {
      email: "search-owner@example.com",
      password: "SecurePass1!",
      fullName: "Search Owner",
      role: "PROPERTY_OWNER",
      consent: true,
    },
    db,
  );
  await verifyEmail({ token: registered.verifyToken }, db);
  const loggedIn = await loginUser({ email: "search-owner@example.com", password: "SecurePass1!" }, db);
  return loggedIn.user;
}

async function seedCustomer() {
  const registered = await registerUser(
    {
      email: "search-buyer@example.com",
      password: "SecurePass1!",
      fullName: "Search Buyer",
      role: "CUSTOMER",
      consent: true,
    },
    db,
  );
  await verifyEmail({ token: registered.verifyToken }, db);
  return loginUser({ email: "search-buyer@example.com", password: "SecurePass1!" }, db);
}

async function insertListing(
  ownerId: string,
  overrides: Partial<typeof listings.$inferInsert> & { title: string },
) {
  const [row] = await db
    .insert(listings)
    .values({
      publicCode: `PF-TEST-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      ownerUserId: ownerId,
      transaction: "sale",
      category: "house_lot",
      description: "Published listing used for PropertyFinder PH search tests in Lipa City.",
      constructionStatus: "resale",
      furnishing: "semi_furnished",
      bedrooms: 3,
      bathrooms: 2,
      parkingSlots: 1,
      floorAreaSqm: "180",
      lotAreaSqm: "300",
      pricePhpCentavos: 8_000_000_00,
      province: "Batangas",
      city: "Lipa City",
      barangay: "San Sebastian",
      status: "published",
      publishedAt: new Date(),
      lat: 13.9411,
      lng: 121.1631,
      ...overrides,
    })
    .returning();
  return row;
}

describe("search validation", () => {
  it("rejects invalid ranges and incomplete bbox", () => {
    expect(searchQuerySchema.safeParse({ minPrice: 5000000, maxPrice: 1000000 }).success).toBe(false);
    expect(searchQuerySchema.safeParse({ minFloorArea: 200, maxFloorArea: 100 }).success).toBe(false);
    expect(searchQuerySchema.safeParse({ west: 120, south: 13 }).success).toBe(false);
    expect(searchQuerySchema.safeParse({ category: "condo", minLotArea: 50 }).success).toBe(false);
    expect(parseSearchParams({ transaction: "sale", city: "Lipa City", page: "2" }).page).toBe(2);
  });
});

describe("published search and favorites", () => {
  beforeAll(() => {
    db = createDb(testUrl);
  });

  beforeEach(async () => {
    await resetDb();
  });

  it("filters combinations, paginates, and excludes unpublished listings", async () => {
    const owner = await seedOwner();
    const lipaSale = await insertListing(owner.id, {
      title: "Lipa garden house for sale",
      transaction: "sale",
      bedrooms: 4,
      bathrooms: 3,
      pricePhpCentavos: 14_800_000_00,
      city: "Lipa City",
      furnishing: "furnished",
      constructionStatus: "rfo",
      floorAreaSqm: "220",
      lotAreaSqm: "450",
      parkingSlots: 2,
    });
    await insertListing(owner.id, {
      title: "Makati condo for rent",
      transaction: "rent",
      category: "condo",
      bedrooms: 1,
      bathrooms: 1,
      pricePhpCentavos: 65_000_00,
      province: "Metro Manila",
      city: "Makati",
      barangay: "Salcedo",
      floorAreaSqm: "58",
      lotAreaSqm: null,
      parkingSlots: 0,
      furnishing: "semi_furnished",
      constructionStatus: "resale",
      lat: 14.5605,
      lng: 121.0244,
    });
    await insertListing(owner.id, {
      title: "Draft should never appear",
      status: "draft",
      publishedAt: null,
      city: "Lipa City",
    });
    await insertListing(owner.id, {
      title: "Pending review should never appear",
      status: "pending_review",
      publishedAt: null,
      city: "Lipa City",
    });
    await db.insert(listingMedia).values({
      listingId: lipaSale.id,
      storageKey: "listings/test/cover.jpg",
      mimeType: "image/jpeg",
      isCover: true,
      sortOrder: 0,
    });

    const saleLipa = await searchPublishedListings(
      parseSearchParams({
        transaction: "sale",
        city: "Lipa City",
        bedrooms: "3",
        minPrice: "10000000",
        maxPrice: "20000000",
        furnishing: "furnished",
        availability: "rfo",
        parking: "2",
        minFloorArea: "200",
        minLotArea: "400",
      }),
      {},
      db,
    );
    expect(saleLipa.total).toBe(1);
    expect(saleLipa.items[0]?.title).toContain("Lipa garden");
    expect(saleLipa.items[0]?.coverUrl).toContain("/uploads/");

    const rentOnly = await searchPublishedListings(parseSearchParams({ transaction: "rent" }), {}, db);
    expect(rentOnly.total).toBe(1);
    expect(rentOnly.items[0]?.city).toBe("Makati");

    const empty = await searchPublishedListings(
      parseSearchParams({ city: "Cebu City", transaction: "sale" }),
      {},
      db,
    );
    expect(empty.total).toBe(0);
    expect(empty.items).toEqual([]);

    await insertListing(owner.id, {
      title: "Second Lipa sale",
      city: "Lipa City",
      pricePhpCentavos: 9_000_000_00,
    });
    await insertListing(owner.id, {
      title: "Third Lipa sale",
      city: "Lipa City",
      pricePhpCentavos: 10_000_000_00,
    });
    const page1 = await searchPublishedListings(
      parseSearchParams({ city: "Lipa City", transaction: "sale", page: "1", pageSize: "2" }),
      {},
      db,
    );
    const page2 = await searchPublishedListings(
      parseSearchParams({ city: "Lipa City", transaction: "sale", page: "2", pageSize: "2" }),
      {},
      db,
    );
    expect(page1.items).toHaveLength(2);
    expect(page2.items).toHaveLength(1);
    expect(page1.total).toBe(3);
    expect(page1.totalPages).toBe(2);

    const bbox = await searchPublishedListings(
      parseSearchParams({
        west: "121.0",
        south: "13.9",
        east: "121.2",
        north: "14.0",
      }),
      {},
      db,
    );
    expect(bbox.items.every((item) => item.city === "Lipa City")).toBe(true);

    const draft = await getPublishedListing("Draft should never appear", {}, db);
    expect(draft).toBeNull();
    const published = await getPublishedListing(lipaSale.id, {}, db);
    expect(published?.status).toBe("published");
  });

  it("supports favorites only for published listings and API access rules", async () => {
    const owner = await seedOwner();
    const buyer = await seedCustomer();
    const published = await insertListing(owner.id, { title: "Favoritable Lipa home" });
    const draft = await insertListing(owner.id, {
      title: "Unpublished home",
      status: "draft",
      publishedAt: null,
    });

    await expect(addFavorite(buyer.user, draft.id, db)).rejects.toThrow(/published/i);
    await addFavorite(buyer.user, published.id, db);
    const favorites = await listFavorites(buyer.user, db);
    expect(favorites).toHaveLength(1);
    expect(favorites[0]?.id).toBe(published.id);

    const unauth = await searchRoute(new Request("http://localhost/api/v1/search?transaction=sale"));
    expect(unauth.status).toBe(200);
    const unauthBody = await unauth.json();
    expect(unauthBody.data.items.every((item: { status?: string }) => item.status == null || item.status === "published")).toBe(
      true,
    );

    const hidden = await publicListingRoute(new Request(`http://localhost/api/v1/public/listings/${draft.id}`), {
      params: Promise.resolve({ id: draft.id }),
    });
    expect(hidden.status).toBe(404);

    const visible = await publicListingRoute(
      new Request(`http://localhost/api/v1/public/listings/${published.id}`),
      { params: Promise.resolve({ id: published.id }) },
    );
    expect(visible.status).toBe(200);

    const saved = await favoritesPost(
      new Request("http://localhost/api/v1/favorites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `${SESSION_COOKIE}=${buyer.session.jwt}`,
        },
        body: JSON.stringify({ listingId: published.id }),
      }),
    );
    expect(saved.status).toBe(201);

    const listed = await favoritesGet(
      new Request("http://localhost/api/v1/favorites", {
        headers: { cookie: `${SESSION_COOKIE}=${buyer.session.jwt}` },
      }),
    );
    expect(listed.status).toBe(200);

    const removed = await favoritesDelete(
      new Request(`http://localhost/api/v1/favorites?listingId=${published.id}`, {
        method: "DELETE",
        headers: { cookie: `${SESSION_COOKIE}=${buyer.session.jwt}` },
      }),
    );
    expect(removed.status).toBe(200);
  });
});
