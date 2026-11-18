/** @vitest-environment node */

import { sql } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST as createInquiryRoute } from "@/app/api/v1/inquiries/route";
import { POST as decideAppointmentRoute } from "@/app/api/v1/appointments/[id]/decide/route";
import { createDb, type Database } from "@/db/client";
import { listings } from "@/db/schema";
import { loginUser, registerUser, verifyEmail } from "@/lib/auth/service";
import { SESSION_COOKIE } from "@/lib/auth/session-token";
import {
  assertAppointmentTransition,
  assertInquiryTransition,
} from "@/lib/inquiries/lifecycle";
import {
  createAppointment,
  createInquiry,
  decideAppointment,
  replyToInquiry,
  updateInquiryStatus,
} from "@/lib/inquiries/service";
import { formatManilaDateTime, parseManilaDateTimeInput, rangesOverlap } from "@/lib/time/manila";
import { clearSentEmails, getSentEmails } from "@/lib/email";

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

async function verifiedUser(email: string, role: "CUSTOMER" | "PROPERTY_OWNER" | "REAL_ESTATE_AGENT") {
  const registered = await registerUser(
    {
      email,
      password: "SecurePass1!",
      fullName: email.split("@")[0]!,
      role,
      consent: true,
      phone: "+639171234567",
    },
    db,
  );
  await verifyEmail({ token: registered.verifyToken }, db);
  return loginUser({ email, password: "SecurePass1!" }, db);
}

async function publishedListing(ownerId: string, brokerUserId?: string | null) {
  const [row] = await db
    .insert(listings)
    .values({
      publicCode: `PF-INQ-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      ownerUserId: ownerId,
      brokerUserId: brokerUserId ?? null,
      transaction: "sale",
      category: "house_lot",
      title: "Lipa viewing villa",
      description: "Published listing for inquiry and appointment workflow tests.",
      bedrooms: 3,
      bathrooms: 2,
      pricePhpCentavos: 9_500_000_00,
      province: "Batangas",
      city: "Lipa City",
      barangay: "San Sebastian",
      status: "published",
      publishedAt: new Date(),
    })
    .returning();
  return row;
}

function futureManilaSlot(hoursFromNow = 48) {
  const start = new Date(Date.now() + hoursFromNow * 3600_000);
  // Normalize to a clean minute for datetime-local style input
  start.setSeconds(0, 0);
  const manilaOffsetMs = 8 * 3600_000;
  const manila = new Date(start.getTime() + manilaOffsetMs);
  const stamp = `${manila.getUTCFullYear()}-${String(manila.getUTCMonth() + 1).padStart(2, "0")}-${String(manila.getUTCDate()).padStart(2, "0")}T${String(manila.getUTCHours()).padStart(2, "0")}:${String(manila.getUTCMinutes()).padStart(2, "0")}`;
  return stamp;
}

describe("Manila time helpers", () => {
  it("parses Asia/Manila wall times and formats output", () => {
    const parsed = parseManilaDateTimeInput("2026-11-20T10:30");
    expect(parsed.toISOString()).toBe("2026-11-20T02:30:00.000Z");
    expect(formatManilaDateTime(parsed)).toContain("2026");
    expect(
      rangesOverlap(
        new Date("2026-11-20T02:00:00.000Z"),
        new Date("2026-11-20T03:00:00.000Z"),
        new Date("2026-11-20T02:30:00.000Z"),
        new Date("2026-11-20T03:30:00.000Z"),
      ),
    ).toBe(true);
  });
});

describe("inquiry and appointment lifecycle matrix", () => {
  it("allows the documented transitions only", () => {
    expect(() => assertInquiryTransition("new", "contacted")).not.toThrow();
    expect(() => assertInquiryTransition("contacted", "viewing_scheduled")).not.toThrow();
    expect(() => assertInquiryTransition("closed", "new")).toThrow();
    expect(() => assertAppointmentTransition("requested", "confirmed")).not.toThrow();
    expect(() => assertAppointmentTransition("confirmed", "reschedule_requested")).not.toThrow();
    expect(() => assertAppointmentTransition("completed", "confirmed")).toThrow();
  });
});

describe("inquiry and appointment workflows", () => {
  beforeAll(() => {
    db = createDb(testUrl);
  });

  beforeEach(async () => {
    await resetDb();
  });

  it("assigns inquiries to broker when present and runs end-to-end viewing workflow", async () => {
    const owner = await verifiedUser("owner-inq@example.com", "PROPERTY_OWNER");
    const agent = await verifiedUser("agent-inq@example.com", "REAL_ESTATE_AGENT");
    const buyer = await verifiedUser("buyer-inq@example.com", "CUSTOMER");
    const listing = await publishedListing(owner.user.id, agent.user.id);

    const inquiry = await createInquiry(
      buyer.user,
      {
        listingId: listing.id,
        contactName: "Buyer Inq",
        contactPhone: "+639179998877",
        message: "I would like to schedule a weekend viewing for this Lipa villa.",
      },
      db,
    );
    expect(inquiry.assigneeUserId).toBe(agent.user.id);
    expect(inquiry.status).toBe("new");
    expect(getSentEmails().some((mail) => mail.to.includes("agent-inq"))).toBe(true);

    const contacted = await replyToInquiry(
      agent.user,
      inquiry.id,
      { body: "Thanks for reaching out. Saturday morning works." },
      db,
    );
    expect(contacted.status).toBe("contacted");

    const slot = futureManilaSlot(72);
    const appointment = await createAppointment(
      buyer.user,
      {
        inquiryId: inquiry.id,
        startsAt: slot,
        note: "Prefer morning",
      },
      db,
    );
    expect(appointment.status).toBe("requested");
    expect(appointment.hostUserId).toBe(agent.user.id);
    expect(appointment.startsAtManila).toBeTruthy();

    const confirmed = await decideAppointment(agent.user, appointment.id, { action: "confirm" }, db);
    expect(confirmed.status).toBe("confirmed");

    const afterConfirmInquiry = await replyToInquiry(
      agent.user,
      inquiry.id,
      { body: "Confirmed for the requested Manila morning slot." },
      db,
    );
    expect(afterConfirmInquiry.status).toBe("viewing_scheduled");

    const completed = await decideAppointment(agent.user, appointment.id, { action: "complete" }, db);
    expect(completed.status).toBe("completed");

    const converted = await updateInquiryStatus(
      agent.user,
      inquiry.id,
      { status: "converted", note: "Buyer proceeded" },
      db,
    );
    expect(converted.status).toBe("converted");
  });

  it("prevents conflicting confirmed appointments under concurrent confirms", async () => {
    const owner = await verifiedUser("owner-conflict@example.com", "PROPERTY_OWNER");
    const buyerA = await verifiedUser("buyer-a@example.com", "CUSTOMER");
    const buyerB = await verifiedUser("buyer-b@example.com", "CUSTOMER");
    const listing = await publishedListing(owner.user.id);

    const inquiryA = await createInquiry(
      buyerA.user,
      {
        listingId: listing.id,
        contactName: "Buyer A",
        message: "Requesting an overlapping Saturday viewing slot for conflict testing.",
      },
      db,
    );
    const inquiryB = await createInquiry(
      buyerB.user,
      {
        listingId: listing.id,
        contactName: "Buyer B",
        message: "Also requesting the same Saturday viewing slot for conflict testing.",
      },
      db,
    );

    const slot = futureManilaSlot(96);
    const appointmentA = await createAppointment(
      buyerA.user,
      { inquiryId: inquiryA.id, startsAt: slot },
      db,
    );
    const appointmentB = await createAppointment(
      buyerB.user,
      { inquiryId: inquiryB.id, startsAt: slot },
      db,
    );

    const results = await Promise.allSettled([
      decideAppointment(owner.user, appointmentA.id, { action: "confirm" }, db),
      decideAppointment(owner.user, appointmentB.id, { action: "confirm" }, db),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(String((rejected[0] as PromiseRejectedResult).reason)).toMatch(/conflict/i);
  });

  it("enforces authorization and rejects unpublished listing inquiries", async () => {
    const owner = await verifiedUser("owner-auth@example.com", "PROPERTY_OWNER");
    const stranger = await verifiedUser("stranger@example.com", "CUSTOMER");
    const buyer = await verifiedUser("buyer-auth@example.com", "CUSTOMER");
    const published = await publishedListing(owner.user.id);
    const [draft] = await db
      .insert(listings)
      .values({
        publicCode: "PF-DRAFT-INQ",
        ownerUserId: owner.user.id,
        transaction: "sale",
        category: "condo",
        title: "Unpublished condo",
        description: "Draft listing must not accept inquiries from customers.",
        pricePhpCentavos: 1_000_000_00,
        province: "Metro Manila",
        city: "Makati",
        barangay: "Poblacion",
        status: "draft",
      })
      .returning();

    await expect(
      createInquiry(
        buyer.user,
        {
          listingId: draft.id,
          contactName: "Buyer",
          message: "This draft inquiry should be rejected by validation rules.",
        },
        db,
      ),
    ).rejects.toThrow(/published/i);

    const inquiry = await createInquiry(
      buyer.user,
      {
        listingId: published.id,
        contactName: "Buyer",
        message: "Authorized inquiry against the published Lipa listing.",
      },
      db,
    );

    await expect(
      replyToInquiry(stranger.user, inquiry.id, { body: "I should not see this thread." }, db),
    ).rejects.toThrow(/access/i);

    const unauth = await createInquiryRoute(
      new Request("http://localhost/api/v1/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: published.id,
          contactName: "Anon",
          message: "Unauthenticated inquiry attempt should fail with 401.",
        }),
      }),
    );
    expect(unauth.status).toBe(401);

    const created = await createInquiryRoute(
      new Request("http://localhost/api/v1/inquiries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `${SESSION_COOKIE}=${buyer.session.jwt}`,
        },
        body: JSON.stringify({
          listingId: published.id,
          contactName: "Buyer Auth",
          message: "API-created inquiry for appointment decision authorization checks.",
        }),
      }),
    );
    expect(created.status).toBe(201);
  });

  it("blocks host confirmation through API when another confirmed slot exists", async () => {
    const owner = await verifiedUser("owner-api@example.com", "PROPERTY_OWNER");
    const buyerA = await verifiedUser("buyer-api-a@example.com", "CUSTOMER");
    const buyerB = await verifiedUser("buyer-api-b@example.com", "CUSTOMER");
    const listing = await publishedListing(owner.user.id);
    const inquiryA = await createInquiry(
      buyerA.user,
      {
        listingId: listing.id,
        contactName: "Buyer A",
        message: "First inquiry for API-level appointment conflict coverage.",
      },
      db,
    );
    const inquiryB = await createInquiry(
      buyerB.user,
      {
        listingId: listing.id,
        contactName: "Buyer B",
        message: "Second inquiry for API-level appointment conflict coverage.",
      },
      db,
    );
    const slot = futureManilaSlot(120);
    const appointmentA = await createAppointment(buyerA.user, { inquiryId: inquiryA.id, startsAt: slot }, db);
    const appointmentB = await createAppointment(buyerB.user, { inquiryId: inquiryB.id, startsAt: slot }, db);

    const first = await decideAppointmentRoute(
      new Request(`http://localhost/api/v1/appointments/${appointmentA.id}/decide`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `${SESSION_COOKIE}=${owner.session.jwt}`,
        },
        body: JSON.stringify({ action: "confirm" }),
      }),
      { params: Promise.resolve({ id: appointmentA.id }) },
    );
    expect(first.status).toBe(200);

    const second = await decideAppointmentRoute(
      new Request(`http://localhost/api/v1/appointments/${appointmentB.id}/decide`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: `${SESSION_COOKIE}=${owner.session.jwt}`,
        },
        body: JSON.stringify({ action: "confirm" }),
      }),
      { params: Promise.resolve({ id: appointmentB.id }) },
    );
    expect(second.status).toBe(409);
  });
});
