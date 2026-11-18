import { and, asc, desc, eq, ne, or, sql } from "drizzle-orm";
import {
  appointmentStatusEvents,
  appointments,
  auditLogs,
  inquiries,
  inquiryMessages,
  inquiryStatusEvents,
  listings,
  type AppointmentStatus,
  type InquiryStatus,
} from "@/db/schema";
import type { Database } from "@/db/client";
import { getDb } from "@/db/client";
import type { AuthUser } from "@/lib/auth/service";
import { AuthorizationError, assertPermission, hasPermission } from "@/lib/auth/rbac";
import {
  AppointmentLifecycleError,
  InquiryLifecycleError,
  assertAppointmentTransition,
  assertInquiryTransition,
  inquiryTerminal,
} from "@/lib/inquiries/lifecycle";
import { notifyUser } from "@/lib/notifications/service";
import {
  defaultAppointmentEnd,
  formatManilaDateTime,
  parseManilaDateTimeInput,
  rangesOverlap,
} from "@/lib/time/manila";
import {
  appointmentDecisionSchema,
  createAppointmentSchema,
  createInquirySchema,
  replyInquirySchema,
  updateInquiryStatusSchema,
} from "@/lib/validation/inquiries";

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

function isAdmin(user: AuthUser) {
  return hasPermission(user.roles, "listing:moderate");
}

function canAccessInquiry(
  user: AuthUser,
  inquiry: { customerUserId: string; assigneeUserId: string },
) {
  if (isAdmin(user)) return true;
  if (inquiry.customerUserId === user.id) return true;
  if (inquiry.assigneeUserId === user.id && hasPermission(user.roles, "inquiry:manage_assigned")) {
    return true;
  }
  return false;
}

function assertInquiryAccess(
  user: AuthUser,
  inquiry: { customerUserId: string; assigneeUserId: string },
) {
  if (!canAccessInquiry(user, inquiry)) {
    throw new AuthorizationError("You cannot access this inquiry");
  }
}

async function loadInquiry(db: Database, inquiryId: string) {
  const [row] = await db.select().from(inquiries).where(eq(inquiries.id, inquiryId)).limit(1);
  if (!row) throw new InquiryLifecycleError("Inquiry not found");
  return row;
}

async function loadAppointment(db: Database, appointmentId: string) {
  const [row] = await db.select().from(appointments).where(eq(appointments.id, appointmentId)).limit(1);
  if (!row) throw new AppointmentLifecycleError("Appointment not found");
  return row;
}

async function recordInquiryStatus(
  db: Database,
  inquiryId: string,
  actorUserId: string,
  fromStatus: InquiryStatus | null,
  toStatus: InquiryStatus,
  note?: string | null,
) {
  await db.insert(inquiryStatusEvents).values({
    inquiryId,
    actorUserId,
    fromStatus,
    toStatus,
    note: note ?? null,
  });
}

async function recordAppointmentStatus(
  db: Database,
  appointmentId: string,
  actorUserId: string,
  fromStatus: AppointmentStatus | null,
  toStatus: AppointmentStatus,
  note?: string | null,
) {
  await db.insert(appointmentStatusEvents).values({
    appointmentId,
    actorUserId,
    fromStatus,
    toStatus,
    note: note ?? null,
  });
}

export async function serializeInquiry(db: Database, inquiryId: string) {
  const inquiry = await loadInquiry(db, inquiryId);
  const [listing] = await db
    .select({
      id: listings.id,
      title: listings.title,
      publicCode: listings.publicCode,
      city: listings.city,
      status: listings.status,
    })
    .from(listings)
    .where(eq(listings.id, inquiry.listingId))
    .limit(1);
  const messages = await db
    .select()
    .from(inquiryMessages)
    .where(eq(inquiryMessages.inquiryId, inquiryId))
    .orderBy(asc(inquiryMessages.createdAt));
  const events = await db
    .select()
    .from(inquiryStatusEvents)
    .where(eq(inquiryStatusEvents.inquiryId, inquiryId))
    .orderBy(desc(inquiryStatusEvents.createdAt));
  const relatedAppointments = await db
    .select()
    .from(appointments)
    .where(eq(appointments.inquiryId, inquiryId))
    .orderBy(desc(appointments.startsAt));

  return {
    ...inquiry,
    listing,
    messages,
    statusEvents: events,
    appointments: relatedAppointments.map((item) => ({
      ...item,
      startsAtManila: formatManilaDateTime(item.startsAt),
      endsAtManila: formatManilaDateTime(item.endsAt),
    })),
  };
}

export async function createInquiry(actor: AuthUser, raw: unknown, db: Database = getDb()) {
  assertPermission(actor.roles, "inquiry:create");
  if (!actor.emailVerifiedAt) {
    throw new InquiryLifecycleError("Verify your email before sending an inquiry");
  }
  const input = createInquirySchema.parse(raw);
  const [listing] = await db.select().from(listings).where(eq(listings.id, input.listingId)).limit(1);
  if (!listing || listing.status !== "published") {
    throw new InquiryLifecycleError("Inquiries are only allowed on published listings");
  }
  const assigneeUserId = listing.brokerUserId ?? listing.ownerUserId;
  if (assigneeUserId === actor.id) {
    throw new InquiryLifecycleError("You cannot inquire on your own listing");
  }

  const [created] = await db
    .insert(inquiries)
    .values({
      listingId: listing.id,
      customerUserId: actor.id,
      assigneeUserId,
      status: "new",
      message: input.message,
      contactName: input.contactName,
      contactPhone: input.contactPhone ?? actor.phoneE164,
      source: input.source,
    })
    .returning();

  await db.insert(inquiryMessages).values({
    inquiryId: created.id,
    senderUserId: actor.id,
    body: input.message,
  });
  await recordInquiryStatus(db, created.id, actor.id, null, "new", "Inquiry created");
  await writeAudit(db, actor.id, "inquiry.create", "inquiry", created.id, {
    listingId: listing.id,
    assigneeUserId,
  });
  await notifyUser(db, {
    userId: assigneeUserId,
    title: "New inquiry received",
    body: `${input.contactName} inquired about ${listing.title} (${listing.publicCode}).`,
    entityType: "inquiry",
    entityId: created.id,
    email: true,
  });

  return serializeInquiry(db, created.id);
}

export async function listInquiriesForUser(actor: AuthUser, db: Database = getDb()) {
  assertPermission(actor.roles, "inquiry:manage_own");
  const rows = await db
    .select()
    .from(inquiries)
    .where(
      isAdmin(actor)
        ? sql`true`
        : or(eq(inquiries.customerUserId, actor.id), eq(inquiries.assigneeUserId, actor.id)),
    )
    .orderBy(desc(inquiries.updatedAt));

  const visible = rows.filter((row) => canAccessInquiry(actor, row));
  return Promise.all(visible.map((row) => serializeInquiry(db, row.id)));
}

export async function getInquiry(actor: AuthUser, inquiryId: string, db: Database = getDb()) {
  const inquiry = await loadInquiry(db, inquiryId);
  assertInquiryAccess(actor, inquiry);
  return serializeInquiry(db, inquiryId);
}

export async function replyToInquiry(
  actor: AuthUser,
  inquiryId: string,
  raw: unknown,
  db: Database = getDb(),
) {
  const inquiry = await loadInquiry(db, inquiryId);
  assertInquiryAccess(actor, inquiry);
  if (inquiryTerminal(inquiry.status)) {
    throw new InquiryLifecycleError("Cannot reply to a closed inquiry");
  }
  const input = replyInquirySchema.parse(raw);
  await db.insert(inquiryMessages).values({
    inquiryId,
    senderUserId: actor.id,
    body: input.body,
  });

  if (actor.id === inquiry.assigneeUserId && inquiry.status === "new") {
    assertInquiryTransition(inquiry.status, "contacted");
    await db
      .update(inquiries)
      .set({ status: "contacted", updatedAt: new Date() })
      .where(eq(inquiries.id, inquiryId));
    await recordInquiryStatus(db, inquiryId, actor.id, "new", "contacted", "Auto-advanced on reply");
  } else {
    await db.update(inquiries).set({ updatedAt: new Date() }).where(eq(inquiries.id, inquiryId));
  }

  await writeAudit(db, actor.id, "inquiry.reply", "inquiry", inquiryId);
  const recipientId =
    actor.id === inquiry.customerUserId ? inquiry.assigneeUserId : inquiry.customerUserId;
  await notifyUser(db, {
    userId: recipientId,
    title: "New inquiry reply",
    body: input.body.slice(0, 240),
    entityType: "inquiry",
    entityId: inquiryId,
    email: true,
  });
  return serializeInquiry(db, inquiryId);
}

export async function updateInquiryStatus(
  actor: AuthUser,
  inquiryId: string,
  raw: unknown,
  db: Database = getDb(),
) {
  const inquiry = await loadInquiry(db, inquiryId);
  assertInquiryAccess(actor, inquiry);
  if (actor.id === inquiry.customerUserId && !isAdmin(actor)) {
    throw new AuthorizationError("Only the assigned owner/agent can change inquiry status");
  }
  assertPermission(actor.roles, "inquiry:manage_assigned");
  const input = updateInquiryStatusSchema.parse(raw);
  assertInquiryTransition(inquiry.status, input.status);
  await db
    .update(inquiries)
    .set({ status: input.status, updatedAt: new Date() })
    .where(eq(inquiries.id, inquiryId));
  await recordInquiryStatus(db, inquiryId, actor.id, inquiry.status, input.status, input.note);
  await writeAudit(db, actor.id, "inquiry.status", "inquiry", inquiryId, {
    from: inquiry.status,
    to: input.status,
  });
  await notifyUser(db, {
    userId: inquiry.customerUserId,
    title: "Inquiry status updated",
    body: `Your inquiry is now ${input.status.replaceAll("_", " ")}.`,
    entityType: "inquiry",
    entityId: inquiryId,
    email: true,
  });
  return serializeInquiry(db, inquiryId);
}

async function assertNoConfirmedConflict(
  db: Database,
  input: {
    listingId: string;
    hostUserId: string;
    startsAt: Date;
    endsAt: Date;
    excludeAppointmentId?: string;
  },
) {
  // Serialize confirmations for the same listing+host with a transaction-scoped advisory lock.
  await db.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${input.listingId}), hashtext(${input.hostUserId}))`,
  );

  const rows = await db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.listingId, input.listingId),
        eq(appointments.hostUserId, input.hostUserId),
        eq(appointments.status, "confirmed"),
        input.excludeAppointmentId
          ? ne(appointments.id, input.excludeAppointmentId)
          : sql`true`,
      ),
    );

  const conflict = rows.find((row) =>
    rangesOverlap(input.startsAt, input.endsAt, row.startsAt, row.endsAt),
  );
  if (conflict) {
    throw new AppointmentLifecycleError(
      `Conflicts with confirmed appointment ${conflict.id} (${formatManilaDateTime(conflict.startsAt)} Asia/Manila)`,
      409,
    );
  }
}

export async function createAppointment(actor: AuthUser, raw: unknown, db: Database = getDb()) {
  assertPermission(actor.roles, "appointment:manage");
  const input = createAppointmentSchema.parse(raw);
  const inquiry = await loadInquiry(db, input.inquiryId);
  assertInquiryAccess(actor, inquiry);
  if (inquiryTerminal(inquiry.status)) {
    throw new AppointmentLifecycleError("Cannot schedule a viewing on a closed inquiry");
  }
  if (actor.id !== inquiry.customerUserId && actor.id !== inquiry.assigneeUserId && !isAdmin(actor)) {
    throw new AuthorizationError("Only the customer or assigned host can request a viewing");
  }

  const [created] = await db
    .insert(appointments)
    .values({
      inquiryId: inquiry.id,
      listingId: inquiry.listingId,
      customerUserId: inquiry.customerUserId,
      hostUserId: inquiry.assigneeUserId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      status: "requested",
      contactPhone: input.contactPhone ?? inquiry.contactPhone,
      note: input.note ?? null,
    })
    .returning();

  await recordAppointmentStatus(db, created.id, actor.id, null, "requested", input.note);
  await writeAudit(db, actor.id, "appointment.create", "appointment", created.id, {
    inquiryId: inquiry.id,
    startsAt: created.startsAt.toISOString(),
  });

  const recipientId =
    actor.id === inquiry.customerUserId ? inquiry.assigneeUserId : inquiry.customerUserId;
  await notifyUser(db, {
    userId: recipientId,
    title: "Viewing requested",
    body: `Proposed viewing on ${formatManilaDateTime(created.startsAt)} (Asia/Manila).`,
    entityType: "appointment",
    entityId: created.id,
    email: true,
  });

  return serializeAppointment(db, created.id);
}

export async function serializeAppointment(db: Database, appointmentId: string) {
  const appointment = await loadAppointment(db, appointmentId);
  const events = await db
    .select()
    .from(appointmentStatusEvents)
    .where(eq(appointmentStatusEvents.appointmentId, appointmentId))
    .orderBy(desc(appointmentStatusEvents.createdAt));
  return {
    ...appointment,
    startsAtManila: formatManilaDateTime(appointment.startsAt),
    endsAtManila: formatManilaDateTime(appointment.endsAt),
    proposedStartsAtManila: appointment.proposedStartsAt
      ? formatManilaDateTime(appointment.proposedStartsAt)
      : null,
    statusEvents: events,
  };
}

export async function decideAppointment(
  actor: AuthUser,
  appointmentId: string,
  raw: unknown,
  db: Database = getDb(),
) {
  assertPermission(actor.roles, "appointment:manage");
  const input = appointmentDecisionSchema.parse(raw);

  return db.transaction(async (tx) => {
    const appointment = await loadAppointment(tx as unknown as Database, appointmentId);
    const inquiry = await loadInquiry(tx as unknown as Database, appointment.inquiryId);
    assertInquiryAccess(actor, inquiry);

    const isHost = actor.id === appointment.hostUserId || isAdmin(actor);
    const isCustomer = actor.id === appointment.customerUserId;

    const actionToStatus: Record<typeof input.action, AppointmentStatus> = {
      confirm: "confirmed",
      decline: "declined",
      cancel: "cancelled",
      complete: "completed",
      request_reschedule: "reschedule_requested",
    };
    const next = actionToStatus[input.action];
    assertAppointmentTransition(appointment.status, next);

    if ((input.action === "confirm" || input.action === "decline" || input.action === "complete") && !isHost) {
      throw new AuthorizationError("Only the assigned host can perform this action");
    }
    if (input.action === "request_reschedule" && !isCustomer && !isHost) {
      throw new AuthorizationError("Only participants can request a reschedule");
    }
    if (input.action === "cancel" && !isCustomer && !isHost) {
      throw new AuthorizationError("Only participants can cancel");
    }

    let startsAt = appointment.startsAt;
    let endsAt = appointment.endsAt;
    let proposedStartsAt = appointment.proposedStartsAt;
    let proposedEndsAt = appointment.proposedEndsAt;

    if (input.action === "request_reschedule") {
      proposedStartsAt = parseManilaDateTimeInput(input.startsAt!);
      proposedEndsAt = input.endsAt
        ? parseManilaDateTimeInput(input.endsAt)
        : defaultAppointmentEnd(proposedStartsAt);
    }

    if (input.action === "confirm") {
      if (appointment.status === "reschedule_requested" && appointment.proposedStartsAt) {
        startsAt = appointment.proposedStartsAt;
        endsAt = appointment.proposedEndsAt ?? defaultAppointmentEnd(startsAt);
      }
      await assertNoConfirmedConflict(tx as unknown as Database, {
        listingId: appointment.listingId,
        hostUserId: appointment.hostUserId,
        startsAt,
        endsAt,
        excludeAppointmentId: appointment.id,
      });
      proposedStartsAt = null;
      proposedEndsAt = null;
    }

    await tx
      .update(appointments)
      .set({
        status: next,
        startsAt,
        endsAt,
        proposedStartsAt,
        proposedEndsAt,
        note: input.note ?? appointment.note,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, appointmentId));

    await recordAppointmentStatus(
      tx as unknown as Database,
      appointmentId,
      actor.id,
      appointment.status,
      next,
      input.note,
    );
    await writeAudit(tx as unknown as Database, actor.id, `appointment.${input.action}`, "appointment", appointmentId, {
      from: appointment.status,
      to: next,
    });

    if (next === "confirmed") {
      if (inquiry.status !== "viewing_scheduled" && !inquiryTerminal(inquiry.status)) {
        assertInquiryTransition(inquiry.status, "viewing_scheduled");
        await tx
          .update(inquiries)
          .set({ status: "viewing_scheduled", updatedAt: new Date() })
          .where(eq(inquiries.id, inquiry.id));
        await recordInquiryStatus(
          tx as unknown as Database,
          inquiry.id,
          actor.id,
          inquiry.status,
          "viewing_scheduled",
          "Viewing confirmed",
        );
      }
    }

    const recipientId = isHost ? appointment.customerUserId : appointment.hostUserId;
    await notifyUser(tx as unknown as Database, {
      userId: recipientId,
      title: `Viewing ${next.replaceAll("_", " ")}`,
      body: `Appointment for ${formatManilaDateTime(startsAt)} (Asia/Manila) is now ${next.replaceAll("_", " ")}.`,
      entityType: "appointment",
      entityId: appointmentId,
      email: true,
    });

    return serializeAppointment(tx as unknown as Database, appointmentId);
  });
}

export async function listAppointmentsForUser(actor: AuthUser, db: Database = getDb()) {
  assertPermission(actor.roles, "appointment:manage");
  const rows = await db
    .select()
    .from(appointments)
    .where(
      isAdmin(actor)
        ? sql`true`
        : or(eq(appointments.customerUserId, actor.id), eq(appointments.hostUserId, actor.id)),
    )
    .orderBy(desc(appointments.startsAt));
  return Promise.all(rows.map((row) => serializeAppointment(db, row.id)));
}

export { InquiryLifecycleError, AppointmentLifecycleError };
