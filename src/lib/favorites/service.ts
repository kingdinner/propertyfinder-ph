import { and, desc, eq } from "drizzle-orm";
import { favorites, listings } from "@/db/schema";
import type { Database } from "@/db/client";
import { getDb } from "@/db/client";
import type { AuthUser } from "@/lib/auth/service";
import { assertPermission } from "@/lib/auth/rbac";
import { getPublishedListing, searchPublishedListings } from "@/lib/search/service";

export class FavoriteError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = "FavoriteError";
  }
}

export async function listFavorites(actor: AuthUser, db: Database = getDb()) {
  assertPermission(actor.roles, "favorite:manage");
  const rows = await db
    .select({ listingId: favorites.listingId, createdAt: favorites.createdAt })
    .from(favorites)
    .innerJoin(listings, eq(listings.id, favorites.listingId))
    .where(and(eq(favorites.userId, actor.id), eq(listings.status, "published")))
    .orderBy(desc(favorites.createdAt));

  const items = [];
  for (const row of rows) {
    const listing = await getPublishedListing(row.listingId, { viewerUserId: actor.id }, db);
    if (listing) items.push({ ...listing, favoritedAt: row.createdAt });
  }
  return items;
}

export async function addFavorite(actor: AuthUser, listingId: string, db: Database = getDb()) {
  assertPermission(actor.roles, "favorite:manage");
  const listing = await getPublishedListing(listingId, { viewerUserId: actor.id }, db);
  if (!listing) throw new FavoriteError("Only published listings can be saved");

  await db
    .insert(favorites)
    .values({ userId: actor.id, listingId: listing.id })
    .onConflictDoNothing({ target: [favorites.userId, favorites.listingId] });
  return { listingId: listing.id, favorited: true };
}

export async function removeFavorite(actor: AuthUser, listingId: string, db: Database = getDb()) {
  assertPermission(actor.roles, "favorite:manage");
  await db
    .delete(favorites)
    .where(and(eq(favorites.userId, actor.id), eq(favorites.listingId, listingId)));
  return { listingId, favorited: false };
}

export async function searchWithViewerFavorites(
  query: Parameters<typeof searchPublishedListings>[0],
  actor: AuthUser | null,
  db: Database = getDb(),
) {
  return searchPublishedListings(query, { viewerUserId: actor?.id }, db);
}
