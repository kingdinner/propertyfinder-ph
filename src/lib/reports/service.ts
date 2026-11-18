import { and, eq } from "drizzle-orm";
import { auditLogs, listingReports, listings, brokerProfiles } from "@/db/schema";
import type { Database } from "@/db/client";
import { getDb } from "@/db/client";
import type { AuthUser } from "@/lib/auth/service";
import { assertPermission } from "@/lib/auth/rbac";
import { z } from "zod";

export class ReportError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = "ReportError";
  }
}

export const createReportSchema = z.object({
  listingId: z.string().uuid(),
  reason: z.string().trim().min(3).max(120),
  details: z.string().trim().max(2000).optional(),
});

export const resolveReportSchema = z.object({
  status: z.enum(["reviewing", "resolved", "dismissed"]),
  resolutionNote: z.string().trim().max(1000).optional(),
});

export const reviewLicenseSchema = z.object({
  status: z.enum(["accepted", "rejected", "unreviewed"]),
});

export async function createListingReport(actor: AuthUser, raw: unknown, db: Database = getDb()) {
  assertPermission(actor.roles, "report:create");
  const input = createReportSchema.parse(raw);
  const [listing] = await db.select().from(listings).where(eq(listings.id, input.listingId)).limit(1);
  if (!listing || listing.status !== "published") {
    throw new ReportError("Only published listings can be reported");
  }
  const [created] = await db
    .insert(listingReports)
    .values({
      listingId: listing.id,
      reporterUserId: actor.id,
      reason: input.reason,
      details: input.details ?? null,
      status: "open",
    })
    .returning();
  await db.insert(auditLogs).values({
    actorUserId: actor.id,
    action: "report.create",
    entityType: "listing_report",
    entityId: created.id,
    metadata: JSON.stringify({ listingId: listing.id, reason: input.reason }),
  });
  return created;
}

export async function resolveListingReport(
  actor: AuthUser,
  reportId: string,
  raw: unknown,
  db: Database = getDb(),
) {
  assertPermission(actor.roles, "admin:manage_reports");
  const input = resolveReportSchema.parse(raw);
  const [report] = await db.select().from(listingReports).where(eq(listingReports.id, reportId)).limit(1);
  if (!report) throw new ReportError("Report not found");
  const [updated] = await db
    .update(listingReports)
    .set({
      status: input.status,
      resolutionNote: input.resolutionNote ?? null,
      resolverUserId: actor.id,
      updatedAt: new Date(),
    })
    .where(eq(listingReports.id, reportId))
    .returning();
  await db.insert(auditLogs).values({
    actorUserId: actor.id,
    action: "report.resolve",
    entityType: "listing_report",
    entityId: reportId,
    metadata: JSON.stringify({ status: input.status }),
  });
  return updated;
}

export async function reviewAgentLicense(
  actor: AuthUser,
  userId: string,
  raw: unknown,
  db: Database = getDb(),
) {
  assertPermission(actor.roles, "admin:review_license");
  const input = reviewLicenseSchema.parse(raw);
  const [profile] = await db
    .select()
    .from(brokerProfiles)
    .where(eq(brokerProfiles.userId, userId))
    .limit(1);
  if (!profile) throw new ReportError("Agent profile not found");
  const [updated] = await db
    .update(brokerProfiles)
    .set({ licenseReviewStatus: input.status, updatedAt: new Date() })
    .where(and(eq(brokerProfiles.userId, userId)))
    .returning();
  await db.insert(auditLogs).values({
    actorUserId: actor.id,
    action: "agent.license_review",
    entityType: "broker_profile",
    entityId: profile.id,
    metadata: JSON.stringify({ status: input.status, userId }),
  });
  return updated;
}
