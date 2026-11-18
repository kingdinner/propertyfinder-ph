import { and, asc, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import {
  appointments,
  brokerProfiles,
  favorites,
  inquiries,
  listingReports,
  listings,
  moderationCases,
  userRoles,
  users,
} from "@/db/schema";
import type { Database } from "@/db/client";
import { getDb } from "@/db/client";
import type { AuthUser } from "@/lib/auth/service";
import { AuthorizationError, assertPermission, hasPermission } from "@/lib/auth/rbac";
import { formatManilaDateTime } from "@/lib/time/manila";
import { getPublishedListing } from "@/lib/search/service";

export type PageParams = { page?: number; pageSize?: number };

function pageOf(input: PageParams) {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, input.pageSize ?? 10));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function paginate<T>(items: T[], total: number, page: number, pageSize: number) {
  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getCustomerDashboard(
  actor: AuthUser,
  filters: {
    tab?: "favorites" | "inquiries" | "appointments" | "profile";
    transaction?: "sale" | "rent";
    page?: number;
    pageSize?: number;
  } = {},
  db: Database = getDb(),
) {
  assertPermission(actor.roles, "portal:customer");
  const { page, pageSize, offset } = pageOf(filters);
  const tab = filters.tab ?? "favorites";

  const activeInquiryStatuses = ["new", "contacted", "qualified", "viewing_scheduled"] as const;
  const upcomingAppointmentStatuses = ["requested", "confirmed", "reschedule_requested"] as const;

  const [[favoritesCount], [inquiriesCount], [appointmentsCount]] = await Promise.all([
    db.select({ total: count() }).from(favorites).where(eq(favorites.userId, actor.id)),
    db
      .select({ total: count() })
      .from(inquiries)
      .where(
        and(eq(inquiries.customerUserId, actor.id), inArray(inquiries.status, [...activeInquiryStatuses])),
      ),
    db
      .select({ total: count() })
      .from(appointments)
      .where(
        and(
          eq(appointments.customerUserId, actor.id),
          inArray(appointments.status, [...upcomingAppointmentStatuses]),
        ),
      ),
  ]);

  const summary = {
    favorites: favoritesCount?.total ?? 0,
    activeInquiries: inquiriesCount?.total ?? 0,
    upcomingAppointments: appointmentsCount?.total ?? 0,
  };
  const profile = {
    id: actor.id,
    fullName: actor.fullName,
    email: actor.email,
    phoneE164: actor.phoneE164,
    emailVerifiedAt: actor.emailVerifiedAt,
    roles: actor.roles,
  };

  if (tab === "profile") {
    return { summary, tab, profile, list: paginate([], 0, page, pageSize) };
  }

  if (tab === "favorites") {
    const conditions = [eq(favorites.userId, actor.id), eq(listings.status, "published")];
    if (filters.transaction) conditions.push(eq(listings.transaction, filters.transaction));
    const whereClause = and(...conditions);
    const [totalRow] = await db
      .select({ total: count() })
      .from(favorites)
      .innerJoin(listings, eq(listings.id, favorites.listingId))
      .where(whereClause);
    const rows = await db
      .select({ listingId: favorites.listingId, createdAt: favorites.createdAt })
      .from(favorites)
      .innerJoin(listings, eq(listings.id, favorites.listingId))
      .where(whereClause)
      .orderBy(desc(favorites.createdAt))
      .limit(pageSize)
      .offset(offset);
    const items = [];
    for (const row of rows) {
      const listing = await getPublishedListing(row.listingId, { viewerUserId: actor.id }, db);
      if (listing) items.push({ ...listing, favoritedAt: row.createdAt });
    }
    return { summary, tab, profile, list: paginate(items, totalRow?.total ?? 0, page, pageSize) };
  }

  if (tab === "inquiries") {
    const whereClause = eq(inquiries.customerUserId, actor.id);
    const [totalRow] = await db.select({ total: count() }).from(inquiries).where(whereClause);
    const rows = await db
      .select({
        id: inquiries.id,
        status: inquiries.status,
        message: inquiries.message,
        contactName: inquiries.contactName,
        updatedAt: inquiries.updatedAt,
        listingId: listings.id,
        listingTitle: listings.title,
        publicCode: listings.publicCode,
        city: listings.city,
      })
      .from(inquiries)
      .innerJoin(listings, eq(listings.id, inquiries.listingId))
      .where(whereClause)
      .orderBy(desc(inquiries.updatedAt))
      .limit(pageSize)
      .offset(offset);
    return {
      summary,
      tab,
      profile,
      list: paginate(
        rows.map((row) => ({
          id: row.id,
          status: row.status,
          message: row.message,
          contactName: row.contactName,
          updatedAt: row.updatedAt,
          listing: {
            id: row.listingId,
            title: row.listingTitle,
            publicCode: row.publicCode,
            city: row.city,
          },
        })),
        totalRow?.total ?? 0,
        page,
        pageSize,
      ),
    };
  }

  const whereClause = eq(appointments.customerUserId, actor.id);
  const [totalRow] = await db.select({ total: count() }).from(appointments).where(whereClause);
  const rows = await db
    .select({
      id: appointments.id,
      status: appointments.status,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      note: appointments.note,
      listingId: listings.id,
      listingTitle: listings.title,
      publicCode: listings.publicCode,
    })
    .from(appointments)
    .innerJoin(listings, eq(listings.id, appointments.listingId))
    .where(whereClause)
    .orderBy(desc(appointments.startsAt))
    .limit(pageSize)
    .offset(offset);

  return {
    summary,
    tab,
    profile,
    list: paginate(
      rows.map((row) => ({
        id: row.id,
        status: row.status,
        note: row.note,
        startsAtManila: formatManilaDateTime(row.startsAt),
        endsAtManila: formatManilaDateTime(row.endsAt),
        listing: {
          id: row.listingId,
          title: row.listingTitle,
          publicCode: row.publicCode,
        },
      })),
      totalRow?.total ?? 0,
      page,
      pageSize,
    ),
  };
}

export async function getAgentDashboard(
  actor: AuthUser,
  filters: {
    tab?: "listings" | "inquiries" | "appointments";
    listingStatus?: string;
    inquiryStatus?: string;
    page?: number;
    pageSize?: number;
  } = {},
  db: Database = getDb(),
) {
  if (!hasPermission(actor.roles, "listing:manage_own")) {
    throw new AuthorizationError("Owner/agent portal required");
  }
  const { page, pageSize, offset } = pageOf(filters);
  const tab = filters.tab ?? "listings";
  const ownedOrAssigned = or(eq(listings.ownerUserId, actor.id), eq(listings.brokerUserId, actor.id));

  const statusRows = await db
    .select({ status: listings.status, total: count() })
    .from(listings)
    .where(ownedOrAssigned)
    .groupBy(listings.status);

  const listingStatusCounts = Object.fromEntries(statusRows.map((row) => [row.status, row.total]));
  const [[inquiryOpen], [appointmentOpen]] = await Promise.all([
    db
      .select({ total: count() })
      .from(inquiries)
      .where(
        and(
          eq(inquiries.assigneeUserId, actor.id),
          inArray(inquiries.status, ["new", "contacted", "qualified", "viewing_scheduled"]),
        ),
      ),
    db
      .select({ total: count() })
      .from(appointments)
      .where(
        and(
          eq(appointments.hostUserId, actor.id),
          inArray(appointments.status, ["requested", "confirmed", "reschedule_requested"]),
        ),
      ),
  ]);

  const summary = {
    listingsTotal: statusRows.reduce((sum, row) => sum + row.total, 0),
    listingStatusCounts,
    openInquiries: inquiryOpen?.total ?? 0,
    openAppointments: appointmentOpen?.total ?? 0,
  };

  if (tab === "listings") {
    const conditions = [ownedOrAssigned];
    if (filters.listingStatus) {
      conditions.push(
        eq(
          listings.status,
          filters.listingStatus as
            | "draft"
            | "pending_review"
            | "needs_revision"
            | "rejected"
            | "published"
            | "archived",
        ),
      );
    }
    const whereClause = and(...conditions);
    const [totalRow] = await db.select({ total: count() }).from(listings).where(whereClause);
    const rows = await db
      .select()
      .from(listings)
      .where(whereClause)
      .orderBy(desc(listings.updatedAt))
      .limit(pageSize)
      .offset(offset);
    return { summary, tab, list: paginate(rows, totalRow?.total ?? 0, page, pageSize) };
  }

  if (tab === "inquiries") {
    const conditions = [eq(inquiries.assigneeUserId, actor.id)];
    if (filters.inquiryStatus) {
      conditions.push(
        eq(
          inquiries.status,
          filters.inquiryStatus as
            | "new"
            | "contacted"
            | "qualified"
            | "viewing_scheduled"
            | "converted"
            | "closed"
            | "lost",
        ),
      );
    }
    const whereClause = and(...conditions);
    const [totalRow] = await db.select({ total: count() }).from(inquiries).where(whereClause);
    const rows = await db
      .select({
        id: inquiries.id,
        status: inquiries.status,
        message: inquiries.message,
        contactName: inquiries.contactName,
        updatedAt: inquiries.updatedAt,
        listingTitle: listings.title,
        publicCode: listings.publicCode,
        listingId: listings.id,
      })
      .from(inquiries)
      .innerJoin(listings, eq(listings.id, inquiries.listingId))
      .where(whereClause)
      .orderBy(desc(inquiries.updatedAt))
      .limit(pageSize)
      .offset(offset);
    return {
      summary,
      tab,
      list: paginate(
        rows.map((row) => ({
          id: row.id,
          status: row.status,
          message: row.message,
          contactName: row.contactName,
          updatedAt: row.updatedAt,
          listing: { id: row.listingId, title: row.listingTitle, publicCode: row.publicCode },
        })),
        totalRow?.total ?? 0,
        page,
        pageSize,
      ),
    };
  }

  const whereClause = eq(appointments.hostUserId, actor.id);
  const [totalRow] = await db.select({ total: count() }).from(appointments).where(whereClause);
  const rows = await db
    .select({
      id: appointments.id,
      status: appointments.status,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      listingTitle: listings.title,
      publicCode: listings.publicCode,
      contactName: inquiries.contactName,
    })
    .from(appointments)
    .innerJoin(listings, eq(listings.id, appointments.listingId))
    .innerJoin(inquiries, eq(inquiries.id, appointments.inquiryId))
    .where(whereClause)
    .orderBy(desc(appointments.startsAt))
    .limit(pageSize)
    .offset(offset);

  return {
    summary,
    tab,
    list: paginate(
      rows.map((row) => ({
        id: row.id,
        status: row.status,
        contactName: row.contactName,
        startsAtManila: formatManilaDateTime(row.startsAt),
        endsAtManila: formatManilaDateTime(row.endsAt),
        listing: { title: row.listingTitle, publicCode: row.publicCode },
      })),
      totalRow?.total ?? 0,
      page,
      pageSize,
    ),
  };
}

export async function getAdminDashboard(
  actor: AuthUser,
  filters: {
    tab?: "moderation" | "listings" | "users" | "agents" | "reports" | "analytics";
    listingStatus?: string;
    reportStatus?: string;
    q?: string;
    page?: number;
    pageSize?: number;
  } = {},
  db: Database = getDb(),
) {
  assertPermission(actor.roles, "portal:admin");
  const { page, pageSize, offset } = pageOf(filters);
  const tab = filters.tab ?? "moderation";

  const [[pending], [published], [rejected], [openReports], [usersTotal], [agentsTotal]] = await Promise.all([
    db.select({ total: count() }).from(listings).where(eq(listings.status, "pending_review")),
    db.select({ total: count() }).from(listings).where(eq(listings.status, "published")),
    db.select({ total: count() }).from(listings).where(eq(listings.status, "rejected")),
    db.select({ total: count() }).from(listingReports).where(eq(listingReports.status, "open")),
    db.select({ total: count() }).from(users),
    db.select({ total: count() }).from(userRoles).where(eq(userRoles.role, "REAL_ESTATE_AGENT")),
  ]);

  const summary = {
    pendingApprovals: pending?.total ?? 0,
    publishedListings: published?.total ?? 0,
    rejectedListings: rejected?.total ?? 0,
    openReports: openReports?.total ?? 0,
    usersTotal: usersTotal?.total ?? 0,
    agentsTotal: agentsTotal?.total ?? 0,
  };

  if (tab === "analytics") {
    assertPermission(actor.roles, "admin:view_analytics");
    const inquiryByStatus = await db
      .select({ status: inquiries.status, total: count() })
      .from(inquiries)
      .groupBy(inquiries.status);
    const listingByStatus = await db
      .select({ status: listings.status, total: count() })
      .from(listings)
      .groupBy(listings.status);
    const appointmentByStatus = await db
      .select({ status: appointments.status, total: count() })
      .from(appointments)
      .groupBy(appointments.status);
    return {
      summary,
      tab,
      analytics: {
        inquiries: Object.fromEntries(inquiryByStatus.map((row) => [row.status, row.total])),
        listings: Object.fromEntries(listingByStatus.map((row) => [row.status, row.total])),
        appointments: Object.fromEntries(appointmentByStatus.map((row) => [row.status, row.total])),
      },
      list: paginate([], 0, page, pageSize),
    };
  }

  if (tab === "moderation") {
    assertPermission(actor.roles, "listing:moderate");
    const whereClause = and(eq(moderationCases.queueStatus, "pending"), eq(listings.status, "pending_review"));
    const [totalRow] = await db
      .select({ total: count() })
      .from(moderationCases)
      .innerJoin(listings, eq(listings.id, moderationCases.listingId))
      .where(whereClause);
    const rows = await db
      .select({
        caseId: moderationCases.id,
        openedAt: moderationCases.openedAt,
        listingId: listings.id,
        publicCode: listings.publicCode,
        title: listings.title,
        city: listings.city,
        province: listings.province,
        pricePhpCentavos: listings.pricePhpCentavos,
        transaction: listings.transaction,
      })
      .from(moderationCases)
      .innerJoin(listings, eq(listings.id, moderationCases.listingId))
      .where(whereClause)
      .orderBy(asc(moderationCases.openedAt))
      .limit(pageSize)
      .offset(offset);
    return { summary, tab, list: paginate(rows, totalRow?.total ?? 0, page, pageSize) };
  }

  if (tab === "listings") {
    assertPermission(actor.roles, "listing:moderate");
    const status = filters.listingStatus ?? "published";
    const whereClause = eq(
      listings.status,
      status as
        | "draft"
        | "pending_review"
        | "needs_revision"
        | "rejected"
        | "published"
        | "archived",
    );
    const [totalRow] = await db.select({ total: count() }).from(listings).where(whereClause);
    const rows = await db
      .select({
        id: listings.id,
        publicCode: listings.publicCode,
        title: listings.title,
        status: listings.status,
        city: listings.city,
        province: listings.province,
        pricePhpCentavos: listings.pricePhpCentavos,
        publishedAt: listings.publishedAt,
        moderationNote: listings.moderationNote,
      })
      .from(listings)
      .where(whereClause)
      .orderBy(desc(listings.updatedAt))
      .limit(pageSize)
      .offset(offset);
    return { summary, tab, list: paginate(rows, totalRow?.total ?? 0, page, pageSize) };
  }

  if (tab === "users") {
    assertPermission(actor.roles, "admin:suspend_user");
    const conditions = [];
    if (filters.q) conditions.push(or(ilike(users.email, `%${filters.q}%`), ilike(users.fullName, `%${filters.q}%`)));
    const whereClause = conditions.length ? and(...conditions) : sql`true`;
    const [totalRow] = await db.select({ total: count() }).from(users).where(whereClause);
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        status: users.status,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(pageSize)
      .offset(offset);
    const roleRows = await db
      .select()
      .from(userRoles)
      .where(inArray(userRoles.userId, rows.map((row) => row.id)));
    const rolesByUser = new Map<string, string[]>();
    for (const row of roleRows) {
      const list = rolesByUser.get(row.userId) ?? [];
      list.push(row.role);
      rolesByUser.set(row.userId, list);
    }
    return {
      summary,
      tab,
      list: paginate(
        rows.map((row) => ({ ...row, roles: rolesByUser.get(row.id) ?? [] })),
        totalRow?.total ?? 0,
        page,
        pageSize,
      ),
    };
  }

  if (tab === "agents") {
    assertPermission(actor.roles, "admin:review_license");
    const [totalRow] = await db
      .select({ total: count() })
      .from(brokerProfiles)
      .innerJoin(users, eq(users.id, brokerProfiles.userId));
    const rows = await db
      .select({
        userId: brokerProfiles.userId,
        displayName: brokerProfiles.displayName,
        agencyName: brokerProfiles.agencyName,
        prcLicenseNo: brokerProfiles.prcLicenseNo,
        licenseReviewStatus: brokerProfiles.licenseReviewStatus,
        email: users.email,
        fullName: users.fullName,
        status: users.status,
      })
      .from(brokerProfiles)
      .innerJoin(users, eq(users.id, brokerProfiles.userId))
      .orderBy(desc(brokerProfiles.updatedAt))
      .limit(pageSize)
      .offset(offset);
    return { summary, tab, list: paginate(rows, totalRow?.total ?? 0, page, pageSize) };
  }

  assertPermission(actor.roles, "admin:manage_reports");
  const conditions = [];
  if (filters.reportStatus) {
    conditions.push(
      eq(listingReports.status, filters.reportStatus as "open" | "reviewing" | "resolved" | "dismissed"),
    );
  }
  const whereClause = conditions.length ? and(...conditions) : sql`true`;
  const [totalRow] = await db.select({ total: count() }).from(listingReports).where(whereClause);
  const rows = await db
    .select({
      id: listingReports.id,
      reason: listingReports.reason,
      details: listingReports.details,
      status: listingReports.status,
      createdAt: listingReports.createdAt,
      listingId: listings.id,
      publicCode: listings.publicCode,
      title: listings.title,
      reporterEmail: users.email,
    })
    .from(listingReports)
    .innerJoin(listings, eq(listings.id, listingReports.listingId))
    .leftJoin(users, eq(users.id, listingReports.reporterUserId))
    .where(whereClause)
    .orderBy(desc(listingReports.createdAt))
    .limit(pageSize)
    .offset(offset);

  return { summary, tab, list: paginate(rows, totalRow?.total ?? 0, page, pageSize) };
}
