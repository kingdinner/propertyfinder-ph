import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import {
  auditLogs,
  listingFinancingOptions,
  listingMedia,
  listings,
  listingStatusEvents,
  moderationCases,
  moderationDecisions,
  users,
  type ListingStatus,
} from "@/db/schema";
import type { Database } from "@/db/client";
import { getDb } from "@/db/client";
import type { AuthUser } from "@/lib/auth/service";
import { AuthorizationError, assertPermission, hasPermission } from "@/lib/auth/rbac";
import { createToken } from "@/lib/auth/crypto";
import {
  assertTransition,
  isEditableStatus,
  ListingLifecycleError,
  type ListingTransition,
} from "@/lib/listings/lifecycle";
import { saveListingImage, publicUploadPath } from "@/lib/storage/local";
import {
  assignBrokerSchema,
  listingDraftSchema,
  listingSubmitSchema,
  moderationDecisionSchema,
} from "@/lib/validation/listings";
import type { z } from "zod";

type DraftInput = z.infer<typeof listingDraftSchema>;
type SubmitInput = z.infer<typeof listingSubmitSchema>;

const MIN_PHOTOS_FOR_REVIEW = 1;

function numOrNull(value: number | null | undefined) {
  if (value == null) return null;
  return String(value);
}

function parseNum(value: string | null) {
  if (value == null) return null;
  return Number(value);
}

function publicCode() {
  const stamp = Date.now().toString(36).toUpperCase();
  return `PF-${stamp}-${createToken(3).toUpperCase()}`;
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

function canManageListing(user: AuthUser, listing: { ownerUserId: string; brokerUserId: string | null }) {
  if (hasPermission(user.roles, "listing:moderate")) return true;
  if (listing.ownerUserId === user.id) return true;
  if (listing.brokerUserId === user.id) return true;
  return false;
}

function assertCanManage(user: AuthUser, listing: { ownerUserId: string; brokerUserId: string | null }) {
  assertPermission(user.roles, "listing:manage_own");
  if (!canManageListing(user, listing)) {
    throw new AuthorizationError("You do not own or manage this listing");
  }
}

async function loadListing(db: Database, listingId: string) {
  const [row] = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
  if (!row) throw new ListingLifecycleError("Listing not found");
  return row;
}

async function financingFor(db: Database, listingId: string) {
  const rows = await db
    .select()
    .from(listingFinancingOptions)
    .where(eq(listingFinancingOptions.listingId, listingId));
  return rows.map((row) => row.option);
}

async function mediaFor(db: Database, listingId: string) {
  const rows = await db
    .select()
    .from(listingMedia)
    .where(eq(listingMedia.listingId, listingId))
    .orderBy(asc(listingMedia.sortOrder));
  return rows.map((row) => ({
    id: row.id,
    url: publicUploadPath(row.storageKey),
    mimeType: row.mimeType,
    sortOrder: row.sortOrder,
    isCover: row.isCover,
    altText: row.altText,
  }));
}

export async function serializeListing(db: Database, listingId: string) {
  const listing = await loadListing(db, listingId);
  const [financingOptions, media, events] = await Promise.all([
    financingFor(db, listingId),
    mediaFor(db, listingId),
    db
      .select()
      .from(listingStatusEvents)
      .where(eq(listingStatusEvents.listingId, listingId))
      .orderBy(desc(listingStatusEvents.createdAt)),
  ]);
  return {
    ...listing,
    floorAreaSqm: parseNum(listing.floorAreaSqm),
    lotAreaSqm: parseNum(listing.lotAreaSqm),
    financingOptions,
    media,
    statusEvents: events,
  };
}

async function replaceFinancing(db: Database, listingId: string, options: DraftInput["financingOptions"]) {
  await db.delete(listingFinancingOptions).where(eq(listingFinancingOptions.listingId, listingId));
  if (options.length === 0) return;
  await db.insert(listingFinancingOptions).values(
    options.map((option) => ({
      listingId,
      option,
    })),
  );
}

async function recordStatus(
  db: Database,
  listingId: string,
  actorUserId: string,
  fromStatus: ListingStatus | null,
  toStatus: ListingStatus,
  note?: string | null,
) {
  await db.insert(listingStatusEvents).values({
    listingId,
    actorUserId,
    fromStatus,
    toStatus,
    note: note ?? null,
  });
}

function listingColumns(input: DraftInput) {
  return {
    transaction: input.transaction,
    category: input.category,
    title: input.title,
    description: input.description,
    constructionStatus: input.constructionStatus,
    furnishing: input.furnishing,
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    powderRooms: input.powderRooms,
    parkingSlots: input.parkingSlots,
    floorAreaSqm: numOrNull(input.floorAreaSqm ?? null),
    lotAreaSqm: numOrNull(input.lotAreaSqm ?? null),
    declaredTitleStatus: input.declaredTitleStatus,
    pricePhpCentavos: input.pricePhpCentavos,
    priceNegotiable: input.priceNegotiable,
    hoaDuesPhpCentavos: input.hoaDuesPhpCentavos ?? null,
    rptStatus: input.rptStatus ?? null,
    province: input.province,
    city: input.city,
    barangay: input.barangay,
    postalCode: input.postalCode ?? null,
    subdivision: input.subdivision ?? null,
    streetAddress: input.streetAddress ?? null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    brokerUserId: input.brokerUserId ?? null,
    updatedAt: new Date(),
  };
}

export async function createDraftListing(actor: AuthUser, raw: unknown, db: Database = getDb()) {
  assertPermission(actor.roles, "listing:create");
  const input = listingDraftSchema.parse(raw);
  if (input.brokerUserId && input.brokerUserId !== actor.id && !hasPermission(actor.roles, "listing:moderate")) {
    // Owners may assign a broker; agents creating listings own them and may leave broker null or self.
    const [broker] = await db.select({ id: users.id }).from(users).where(eq(users.id, input.brokerUserId)).limit(1);
    if (!broker) throw new ListingLifecycleError("Assigned broker not found");
  }

  const [created] = await db
    .insert(listings)
    .values({
      publicCode: publicCode(),
      ownerUserId: actor.id,
      status: "draft",
      ...listingColumns(input),
    })
    .returning();

  await replaceFinancing(db, created.id, input.financingOptions);
  await recordStatus(db, created.id, actor.id, null, "draft", "Created draft");
  await writeAudit(db, actor.id, "listing.create_draft", "listing", created.id);
  return serializeListing(db, created.id);
}

export async function updateListingDraft(
  actor: AuthUser,
  listingId: string,
  raw: unknown,
  db: Database = getDb(),
) {
  const listing = await loadListing(db, listingId);
  assertCanManage(actor, listing);
  assertTransition(listing.status, "save_draft");
  const input = listingDraftSchema.parse(raw);

  await db
    .update(listings)
    .set(listingColumns(input))
    .where(eq(listings.id, listingId));
  await replaceFinancing(db, listingId, input.financingOptions);
  await writeAudit(db, actor.id, "listing.save_draft", "listing", listingId);
  return serializeListing(db, listingId);
}

async function ensureReadyForReview(db: Database, listingId: string, input: SubmitInput) {
  listingSubmitSchema.parse(input);
  const media = await mediaFor(db, listingId);
  if (media.length < MIN_PHOTOS_FOR_REVIEW) {
    throw new ListingLifecycleError(`At least ${MIN_PHOTOS_FOR_REVIEW} photo is required before review`);
  }
}

async function openModerationCase(db: Database, listingId: string) {
  await db
    .update(moderationCases)
    .set({ queueStatus: "decided", closedAt: new Date() })
    .where(and(eq(moderationCases.listingId, listingId), eq(moderationCases.queueStatus, "pending")));
  const [opened] = await db
    .insert(moderationCases)
    .values({ listingId, queueStatus: "pending" })
    .returning();
  return opened;
}

export async function submitListing(
  actor: AuthUser,
  listingId: string,
  raw: unknown | undefined,
  mode: "submit" | "resubmit",
  db: Database = getDb(),
) {
  const listing = await loadListing(db, listingId);
  assertCanManage(actor, listing);
  const transition: ListingTransition = mode;
  const next = assertTransition(listing.status, transition);

  if (!actor.emailVerifiedAt) {
    throw new ListingLifecycleError("Verify your email before submitting a listing for review");
  }

  let payload: SubmitInput;
  if (raw) {
    payload = listingSubmitSchema.parse(raw);
    await db.update(listings).set(listingColumns(payload)).where(eq(listings.id, listingId));
    await replaceFinancing(db, listingId, payload.financingOptions);
  } else {
    const financingOptions = await financingFor(db, listingId);
    payload = listingSubmitSchema.parse({
      transaction: listing.transaction,
      category: listing.category,
      title: listing.title,
      description: listing.description,
      constructionStatus: listing.constructionStatus,
      furnishing: listing.furnishing,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      powderRooms: listing.powderRooms,
      parkingSlots: listing.parkingSlots,
      floorAreaSqm: parseNum(listing.floorAreaSqm),
      lotAreaSqm: parseNum(listing.lotAreaSqm),
      declaredTitleStatus: listing.declaredTitleStatus,
      pricePhpCentavos: listing.pricePhpCentavos,
      priceNegotiable: listing.priceNegotiable,
      hoaDuesPhpCentavos: listing.hoaDuesPhpCentavos,
      rptStatus: listing.rptStatus,
      province: listing.province,
      city: listing.city,
      barangay: listing.barangay,
      postalCode: listing.postalCode,
      subdivision: listing.subdivision,
      streetAddress: listing.streetAddress,
      lat: listing.lat,
      lng: listing.lng,
      brokerUserId: listing.brokerUserId,
      financingOptions,
    });
  }

  await ensureReadyForReview(db, listingId, payload);
  await db
    .update(listings)
    .set({
      status: next,
      moderationNote: null,
      updatedAt: new Date(),
    })
    .where(eq(listings.id, listingId));
  await openModerationCase(db, listingId);
  await recordStatus(db, listingId, actor.id, listing.status, next, mode === "resubmit" ? "Resubmitted" : "Submitted for review");
  await writeAudit(db, actor.id, `listing.${mode}`, "listing", listingId);
  return serializeListing(db, listingId);
}

export async function archiveListing(actor: AuthUser, listingId: string, db: Database = getDb()) {
  const listing = await loadListing(db, listingId);
  assertCanManage(actor, listing);
  const next = assertTransition(listing.status, "archive");
  await db
    .update(listings)
    .set({ status: next, updatedAt: new Date() })
    .where(eq(listings.id, listingId));
  await db
    .update(moderationCases)
    .set({ queueStatus: "decided", closedAt: new Date() })
    .where(and(eq(moderationCases.listingId, listingId), eq(moderationCases.queueStatus, "pending")));
  await recordStatus(db, listingId, actor.id, listing.status, next, "Archived");
  await writeAudit(db, actor.id, "listing.archive", "listing", listingId);
  return serializeListing(db, listingId);
}

export async function assignBroker(
  actor: AuthUser,
  listingId: string,
  raw: unknown,
  db: Database = getDb(),
) {
  const listing = await loadListing(db, listingId);
  assertCanManage(actor, listing);
  if (!isEditableStatus(listing.status) && listing.status !== "published") {
    throw new ListingLifecycleError("Cannot assign broker in the current status");
  }
  const input = assignBrokerSchema.parse(raw);
  if (input.brokerUserId) {
    const [broker] = await db.select({ id: users.id }).from(users).where(eq(users.id, input.brokerUserId)).limit(1);
    if (!broker) throw new ListingLifecycleError("Assigned broker not found");
  }
  await db
    .update(listings)
    .set({ brokerUserId: input.brokerUserId, updatedAt: new Date() })
    .where(eq(listings.id, listingId));
  await writeAudit(db, actor.id, "listing.assign_broker", "listing", listingId, {
    brokerUserId: input.brokerUserId,
  });
  return serializeListing(db, listingId);
}

export async function addListingImage(
  actor: AuthUser,
  listingId: string,
  file: File,
  db: Database = getDb(),
) {
  const listing = await loadListing(db, listingId);
  assertCanManage(actor, listing);
  if (!isEditableStatus(listing.status)) {
    throw new ListingLifecycleError("Images can only be uploaded while the listing is editable");
  }
  const saved = await saveListingImage(listingId, file);
  const existing = await mediaFor(db, listingId);
  const [row] = await db
    .insert(listingMedia)
    .values({
      listingId,
      storageKey: saved.storageKey,
      mimeType: saved.mimeType,
      sortOrder: existing.length,
      isCover: existing.length === 0,
    })
    .returning();
  await writeAudit(db, actor.id, "listing.upload_image", "listing", listingId, { mediaId: row.id });
  return serializeListing(db, listingId);
}

export async function listOwnListings(actor: AuthUser, db: Database = getDb()) {
  assertPermission(actor.roles, "listing:manage_own");
  const rows = await db
    .select()
    .from(listings)
    .where(
      hasPermission(actor.roles, "listing:moderate")
        ? sql`true`
        : or(eq(listings.ownerUserId, actor.id), eq(listings.brokerUserId, actor.id)),
    )
    .orderBy(desc(listings.updatedAt));
  return Promise.all(rows.map((row) => serializeListing(db, row.id)));
}

export async function getManagedListing(actor: AuthUser, listingId: string, db: Database = getDb()) {
  const listing = await loadListing(db, listingId);
  assertCanManage(actor, listing);
  return serializeListing(db, listingId);
}

export async function listModerationQueue(actor: AuthUser, db: Database = getDb()) {
  assertPermission(actor.roles, "listing:moderate");
  const pending = await db
    .select({
      caseId: moderationCases.id,
      listingId: moderationCases.listingId,
      openedAt: moderationCases.openedAt,
      queueStatus: moderationCases.queueStatus,
    })
    .from(moderationCases)
    .innerJoin(listings, eq(listings.id, moderationCases.listingId))
    .where(and(eq(moderationCases.queueStatus, "pending"), eq(listings.status, "pending_review")))
    .orderBy(moderationCases.openedAt);
  return Promise.all(
    pending.map(async (item) => ({
      ...item,
      listing: await serializeListing(db, item.listingId),
    })),
  );
}

export async function decideModeration(
  actor: AuthUser,
  listingId: string,
  raw: unknown,
  db: Database = getDb(),
) {
  assertPermission(actor.roles, "listing:moderate");
  const listing = await loadListing(db, listingId);
  const input = moderationDecisionSchema.parse(raw);
  const transition: ListingTransition =
    input.outcome === "approve"
      ? "approve"
      : input.outcome === "request_changes"
        ? "request_changes"
        : "reject";
  const next = assertTransition(listing.status, transition);

  const [openCase] = await db
    .select()
    .from(moderationCases)
    .where(and(eq(moderationCases.listingId, listingId), eq(moderationCases.queueStatus, "pending")))
    .orderBy(desc(moderationCases.openedAt))
    .limit(1);
  if (!openCase) throw new ListingLifecycleError("No open moderation case for this listing");

  await db.insert(moderationDecisions).values({
    caseId: openCase.id,
    actorUserId: actor.id,
    outcome: input.outcome,
    noteToLister: input.noteToLister ?? null,
  });

  await db
    .update(moderationCases)
    .set({
      queueStatus: "decided",
      closedAt: new Date(),
      assigneeUserId: actor.id,
    })
    .where(eq(moderationCases.id, openCase.id));

  await db
    .update(listings)
    .set({
      status: next,
      moderationNote: input.noteToLister ?? null,
      publishedAt: next === "published" ? new Date() : listing.publishedAt,
      updatedAt: new Date(),
    })
    .where(eq(listings.id, listingId));

  await recordStatus(db, listingId, actor.id, listing.status, next, input.noteToLister ?? input.outcome);
  await writeAudit(db, actor.id, `listing.moderate.${input.outcome}`, "listing", listingId, {
    outcome: input.outcome,
  });
  return serializeListing(db, listingId);
}

export async function listRecentDecisions(actor: AuthUser, limit = 20, db: Database = getDb()) {
  assertPermission(actor.roles, "listing:moderate");
  const rows = await db
    .select({
      id: moderationDecisions.id,
      outcome: moderationDecisions.outcome,
      noteToLister: moderationDecisions.noteToLister,
      createdAt: moderationDecisions.createdAt,
      listingId: moderationCases.listingId,
      publicCode: listings.publicCode,
      title: listings.title,
    })
    .from(moderationDecisions)
    .innerJoin(moderationCases, eq(moderationCases.id, moderationDecisions.caseId))
    .innerJoin(listings, eq(listings.id, moderationCases.listingId))
    .orderBy(desc(moderationDecisions.createdAt))
    .limit(limit);
  return rows;
}

export { ListingLifecycleError, isEditableStatus };
