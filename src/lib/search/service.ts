import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import {
  brokerProfiles,
  favorites,
  listingMedia,
  listings,
  users,
} from "@/db/schema";
import type { Database } from "@/db/client";
import { getDb } from "@/db/client";
import { publicUploadPath } from "@/lib/storage/local";
import type { SearchQuery } from "@/lib/validation/search";

function pesosToCentavos(pesos: number) {
  return Math.round(pesos * 100);
}

function parseNum(value: string | null) {
  if (value == null) return null;
  return Number(value);
}

function locationLine(row: {
  subdivision: string | null;
  barangay: string;
  city: string;
  province: string;
}) {
  return [row.subdivision, row.barangay, row.city, row.province].filter(Boolean).join(", ");
}

export type SearchHit = {
  id: string;
  publicCode: string;
  title: string;
  transaction: "sale" | "rent";
  category: "house_lot" | "condo" | "townhouse" | "lot" | "commercial";
  priceCentavos: number;
  location: string;
  city: string;
  province: string;
  barangay: string;
  bedrooms: number;
  bathrooms: number;
  floorAreaSqm: number;
  lotAreaSqm: number | null;
  parking: number;
  furnishing: string;
  availability: string;
  constructionStatus: string;
  declaredTitleStatus: string;
  lat: number | null;
  lng: number | null;
  publishedAt: Date | null;
  coverUrl: string | null;
  broker: string;
  prcLicense: string;
  badge: string;
  tone: "sale" | "rent";
  isFavorited: boolean;
};

function buildFilters(query: SearchQuery): SQL[] {
  const filters: SQL[] = [eq(listings.status, "published")];

  if (query.transaction) filters.push(eq(listings.transaction, query.transaction));
  if (query.category) filters.push(eq(listings.category, query.category));
  if (query.province) filters.push(ilike(listings.province, query.province));
  if (query.city) filters.push(ilike(listings.city, query.city));
  if (query.barangay) filters.push(ilike(listings.barangay, query.barangay));
  if (query.minPrice != null) filters.push(gte(listings.pricePhpCentavos, pesosToCentavos(query.minPrice)));
  if (query.maxPrice != null) filters.push(lte(listings.pricePhpCentavos, pesosToCentavos(query.maxPrice)));
  if (query.bedrooms != null) filters.push(gte(listings.bedrooms, query.bedrooms));
  if (query.bathrooms != null) filters.push(gte(listings.bathrooms, query.bathrooms));
  if (query.parking != null) filters.push(gte(listings.parkingSlots, query.parking));
  if (query.furnishing) filters.push(eq(listings.furnishing, query.furnishing));
  if (query.availability) filters.push(eq(listings.constructionStatus, query.availability));
  if (query.minFloorArea != null) {
    filters.push(sql`${listings.floorAreaSqm}::numeric >= ${query.minFloorArea}`);
  }
  if (query.maxFloorArea != null) {
    filters.push(sql`${listings.floorAreaSqm}::numeric <= ${query.maxFloorArea}`);
  }
  if (query.minLotArea != null) {
    filters.push(sql`${listings.lotAreaSqm}::numeric >= ${query.minLotArea}`);
  }
  if (query.maxLotArea != null) {
    filters.push(sql`${listings.lotAreaSqm}::numeric <= ${query.maxLotArea}`);
  }
  if (query.q) {
    const pattern = `%${query.q}%`;
    filters.push(
      or(
        ilike(listings.title, pattern),
        ilike(listings.description, pattern),
        ilike(listings.city, pattern),
        ilike(listings.province, pattern),
        ilike(listings.barangay, pattern),
        ilike(listings.subdivision, pattern),
      )!,
    );
  }
  if (query.west != null && query.south != null && query.east != null && query.north != null) {
    filters.push(sql`${listings.lat} IS NOT NULL AND ${listings.lng} IS NOT NULL`);
    filters.push(gte(listings.lat, query.south));
    filters.push(lte(listings.lat, query.north));
    filters.push(gte(listings.lng, query.west));
    filters.push(lte(listings.lng, query.east));
  }

  return filters;
}

function orderFor(sort: SearchQuery["sort"]) {
  switch (sort) {
    case "price_asc":
      return [asc(listings.pricePhpCentavos), desc(listings.publishedAt)];
    case "price_desc":
      return [desc(listings.pricePhpCentavos), desc(listings.publishedAt)];
    case "beds_desc":
      return [desc(listings.bedrooms), desc(listings.publishedAt)];
    case "newest":
    default:
      return [desc(listings.publishedAt), desc(listings.createdAt)];
  }
}

function badgeFor(row: {
  transaction: "sale" | "rent";
  constructionStatus: string;
  declaredTitleStatus: string;
}) {
  if (row.transaction === "rent") return "For rent";
  if (row.constructionStatus === "rfo") return "Ready for occupancy";
  if (row.constructionStatus === "preselling") return "Pre-selling";
  if (row.declaredTitleStatus === "clean_tct_cct") return "Declared clean title";
  return "Published";
}

async function coverMap(db: Database, listingIds: string[]) {
  if (listingIds.length === 0) return new Map<string, string>();
  const rows = await db
    .select({
      listingId: listingMedia.listingId,
      storageKey: listingMedia.storageKey,
      isCover: listingMedia.isCover,
      sortOrder: listingMedia.sortOrder,
    })
    .from(listingMedia)
    .where(inArray(listingMedia.listingId, listingIds));
  const map = new Map<string, string>();
  const sorted = [...rows].sort((a, b) => Number(b.isCover) - Number(a.isCover) || a.sortOrder - b.sortOrder);
  for (const row of sorted) {
    if (!map.has(row.listingId)) map.set(row.listingId, publicUploadPath(row.storageKey));
  }
  return map;
}

async function favoriteSet(db: Database, userId: string | undefined, listingIds: string[]) {
  if (!userId || listingIds.length === 0) return new Set<string>();
  const rows = await db
    .select({ listingId: favorites.listingId })
    .from(favorites)
    .where(and(eq(favorites.userId, userId), inArray(favorites.listingId, listingIds)));
  return new Set(rows.map((row) => row.listingId));
}

export async function searchPublishedListings(
  query: SearchQuery,
  options: { viewerUserId?: string } = {},
  db: Database = getDb(),
) {
  const filters = buildFilters(query);
  const whereClause = and(...filters);
  const offset = (query.page - 1) * query.pageSize;

  const [totalRow] = await db.select({ total: count() }).from(listings).where(whereClause);
  const rows = await db
    .select({
      id: listings.id,
      publicCode: listings.publicCode,
      title: listings.title,
      transaction: listings.transaction,
      category: listings.category,
      pricePhpCentavos: listings.pricePhpCentavos,
      province: listings.province,
      city: listings.city,
      barangay: listings.barangay,
      subdivision: listings.subdivision,
      bedrooms: listings.bedrooms,
      bathrooms: listings.bathrooms,
      parkingSlots: listings.parkingSlots,
      floorAreaSqm: listings.floorAreaSqm,
      lotAreaSqm: listings.lotAreaSqm,
      furnishing: listings.furnishing,
      constructionStatus: listings.constructionStatus,
      declaredTitleStatus: listings.declaredTitleStatus,
      lat: listings.lat,
      lng: listings.lng,
      publishedAt: listings.publishedAt,
      brokerName: users.fullName,
      brokerDisplayName: brokerProfiles.displayName,
      prcLicenseNo: brokerProfiles.prcLicenseNo,
    })
    .from(listings)
    .leftJoin(users, eq(users.id, listings.brokerUserId))
    .leftJoin(brokerProfiles, eq(brokerProfiles.userId, listings.brokerUserId))
    .where(whereClause)
    .orderBy(...orderFor(query.sort))
    .limit(query.pageSize)
    .offset(offset);

  const ids = rows.map((row) => row.id);
  const [covers, liked] = await Promise.all([
    coverMap(db, ids),
    favoriteSet(db, options.viewerUserId, ids),
  ]);

  const items: SearchHit[] = rows.map((row) => ({
    id: row.id,
    publicCode: row.publicCode,
    title: row.title,
    transaction: row.transaction,
    category: row.category,
    priceCentavos: row.pricePhpCentavos,
    location: locationLine(row),
    city: row.city,
    province: row.province,
    barangay: row.barangay,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    floorAreaSqm: parseNum(row.floorAreaSqm) ?? 0,
    lotAreaSqm: parseNum(row.lotAreaSqm),
    parking: row.parkingSlots,
    furnishing: row.furnishing,
    availability: row.constructionStatus,
    constructionStatus: row.constructionStatus,
    declaredTitleStatus: row.declaredTitleStatus,
    lat: row.lat,
    lng: row.lng,
    publishedAt: row.publishedAt,
    coverUrl: covers.get(row.id) ?? null,
    broker: row.brokerDisplayName ?? row.brokerName ?? "PropertyFinder PH lister",
    prcLicense: row.prcLicenseNo ? `PRC #${row.prcLicenseNo}` : "Self-listed",
    badge: badgeFor(row),
    tone: row.transaction,
    isFavorited: liked.has(row.id),
  }));

  const total = totalRow?.total ?? 0;
  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    filters: query,
  };
}

export async function getPublishedListing(
  idOrCode: string,
  options: { viewerUserId?: string } = {},
  db: Database = getDb(),
) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    idOrCode,
  );
  const identity = isUuid
    ? or(eq(listings.id, idOrCode), eq(listings.publicCode, idOrCode))
    : eq(listings.publicCode, idOrCode);

  const [row] = await db
    .select({
      id: listings.id,
      publicCode: listings.publicCode,
      title: listings.title,
      description: listings.description,
      transaction: listings.transaction,
      category: listings.category,
      pricePhpCentavos: listings.pricePhpCentavos,
      priceNegotiable: listings.priceNegotiable,
      province: listings.province,
      city: listings.city,
      barangay: listings.barangay,
      subdivision: listings.subdivision,
      streetAddress: listings.streetAddress,
      bedrooms: listings.bedrooms,
      bathrooms: listings.bathrooms,
      powderRooms: listings.powderRooms,
      parkingSlots: listings.parkingSlots,
      floorAreaSqm: listings.floorAreaSqm,
      lotAreaSqm: listings.lotAreaSqm,
      furnishing: listings.furnishing,
      constructionStatus: listings.constructionStatus,
      declaredTitleStatus: listings.declaredTitleStatus,
      lat: listings.lat,
      lng: listings.lng,
      publishedAt: listings.publishedAt,
      status: listings.status,
      brokerName: users.fullName,
      brokerDisplayName: brokerProfiles.displayName,
      prcLicenseNo: brokerProfiles.prcLicenseNo,
    })
    .from(listings)
    .leftJoin(users, eq(users.id, listings.brokerUserId))
    .leftJoin(brokerProfiles, eq(brokerProfiles.userId, listings.brokerUserId))
    .where(and(eq(listings.status, "published"), identity))
    .limit(1);

  if (!row) return null;

  const media = await db
    .select()
    .from(listingMedia)
    .where(eq(listingMedia.listingId, row.id))
    .orderBy(asc(listingMedia.sortOrder));
  const liked = await favoriteSet(db, options.viewerUserId, [row.id]);

  const related = await searchPublishedListings(
    {
      transaction: row.transaction,
      city: row.city,
      page: 1,
      pageSize: 3,
      sort: "newest",
    },
    options,
    db,
  );

  return {
    ...row,
    floorAreaSqm: parseNum(row.floorAreaSqm) ?? 0,
    lotAreaSqm: parseNum(row.lotAreaSqm),
    priceCentavos: row.pricePhpCentavos,
    location: locationLine(row),
    parking: row.parkingSlots,
    availability: row.constructionStatus,
    broker: row.brokerDisplayName ?? row.brokerName ?? "PropertyFinder PH lister",
    prcLicense: row.prcLicenseNo ? `PRC #${row.prcLicenseNo}` : "Self-listed",
    badge: badgeFor(row),
    tone: row.transaction as "sale" | "rent",
    isFavorited: liked.has(row.id),
    media: media.map((item) => ({
      id: item.id,
      url: publicUploadPath(item.storageKey),
      isCover: item.isCover,
    })),
    related: related.items.filter((item) => item.id !== row.id).slice(0, 2),
  };
}

export async function listDistinctPublishedCities(db: Database = getDb()) {
  const rows = await db
    .selectDistinct({ city: listings.city, province: listings.province })
    .from(listings)
    .where(and(eq(listings.status, "published"), sql`${listings.city} <> ''`))
    .orderBy(asc(listings.province), asc(listings.city));
  return rows;
}
