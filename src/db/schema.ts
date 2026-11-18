import {
  boolean,
  doublePrecision,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const userStatusEnum = pgEnum("user_status", ["active", "suspended"]);

export const roleEnum = pgEnum("user_role", [
  "CUSTOMER",
  "PROPERTY_OWNER",
  "REAL_ESTATE_AGENT",
  "ADMIN",
]);

export const licenseReviewStatusEnum = pgEnum("license_review_status", [
  "unreviewed",
  "accepted",
  "rejected",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    fullName: text("full_name").notNull(),
    phoneE164: text("phone_e164"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    status: userStatusEnum("status").notNull().default("active"),
    activePortal: roleEnum("active_portal"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_email_uidx").on(table.email)],
);

export const userRoles = pgTable(
  "user_roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("user_roles_user_role_uidx").on(table.userId, table.role),
    index("user_roles_user_idx").on(table.userId),
  ],
);

export const brokerProfiles = pgTable(
  "broker_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    agencyName: text("agency_name"),
    prcLicenseNo: text("prc_license_no"),
    dhsudRegistrationNo: text("dhsud_registration_no"),
    bio: text("bio"),
    licenseReviewStatus: licenseReviewStatusEnum("license_review_status").notNull().default("unreviewed"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("broker_profiles_user_uidx").on(table.userId)],
);

export const consentRecords = pgTable("consent_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  termsVersion: text("terms_version").notNull(),
  privacyVersion: text("privacy_version").notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_uidx").on(table.tokenHash),
    index("sessions_user_idx").on(table.userId),
  ],
);

export const emailVerificationTokens = pgTable(
  "email_verification_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("email_verification_token_hash_uidx").on(table.tokenHash)],
);

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("password_reset_token_hash_uidx").on(table.tokenHash)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    metadata: text("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("audit_logs_actor_idx").on(table.actorUserId)],
);

export const listingTransactionEnum = pgEnum("listing_transaction", ["sale", "rent"]);

export const listingCategoryEnum = pgEnum("listing_category", [
  "house_lot",
  "condo",
  "townhouse",
  "lot",
  "commercial",
]);

export const constructionStatusEnum = pgEnum("construction_status", [
  "rfo",
  "preselling",
  "resale",
]);

export const furnishingEnum = pgEnum("furnishing_status", [
  "unfurnished",
  "semi_furnished",
  "furnished",
]);

export const titleStatusEnum = pgEnum("declared_title_status", [
  "clean_tct_cct",
  "mortgaged",
  "tax_declaration",
  "estate_settlement",
  "unspecified",
]);

export const listingStatusEnum = pgEnum("listing_status", [
  "draft",
  "pending_review",
  "needs_revision",
  "rejected",
  "published",
  "archived",
]);

export const financingOptionEnum = pgEnum("financing_option", [
  "cash",
  "bank",
  "in_house",
  "pagibig",
]);

export const documentKindEnum = pgEnum("listing_document_kind", ["title", "tax", "other"]);

export const moderationQueueStatusEnum = pgEnum("moderation_queue_status", [
  "pending",
  "needs_revision",
  "flagged",
  "decided",
]);

export const moderationOutcomeEnum = pgEnum("moderation_outcome", [
  "approve",
  "request_changes",
  "reject",
]);

export const listings = pgTable(
  "listings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    publicCode: text("public_code").notNull(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    brokerUserId: uuid("broker_user_id").references(() => users.id, { onDelete: "set null" }),
    transaction: listingTransactionEnum("transaction").notNull(),
    category: listingCategoryEnum("category").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    constructionStatus: constructionStatusEnum("construction_status").notNull().default("resale"),
    furnishing: furnishingEnum("furnishing").notNull().default("unfurnished"),
    bedrooms: integer("bedrooms").notNull().default(0),
    bathrooms: integer("bathrooms").notNull().default(0),
    powderRooms: integer("powder_rooms").notNull().default(0),
    parkingSlots: integer("parking_slots").notNull().default(0),
    floorAreaSqm: numeric("floor_area_sqm", { precision: 12, scale: 2 }),
    lotAreaSqm: numeric("lot_area_sqm", { precision: 12, scale: 2 }),
    declaredTitleStatus: titleStatusEnum("declared_title_status").notNull().default("unspecified"),
    pricePhpCentavos: integer("price_php_centavos").notNull().default(0),
    priceNegotiable: boolean("price_negotiable").notNull().default(false),
    hoaDuesPhpCentavos: integer("hoa_dues_php_centavos"),
    rptStatus: text("rpt_status"),
    province: text("province").notNull().default(""),
    city: text("city").notNull().default(""),
    barangay: text("barangay").notNull().default(""),
    postalCode: text("postal_code"),
    subdivision: text("subdivision"),
    streetAddress: text("street_address"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    status: listingStatusEnum("status").notNull().default("draft"),
    moderationNote: text("moderation_note"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("listings_public_code_uidx").on(table.publicCode),
    index("listings_owner_idx").on(table.ownerUserId),
    index("listings_broker_idx").on(table.brokerUserId),
    index("listings_status_tx_city_idx").on(table.status, table.transaction, table.city),
    index("listings_published_price_idx").on(table.status, table.pricePhpCentavos),
    index("listings_published_beds_idx").on(table.status, table.bedrooms),
    index("listings_published_at_idx").on(table.status, table.publishedAt),
    index("listings_lat_lng_idx").on(table.lat, table.lng),
  ],
);

export const favorites = pgTable(
  "favorites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("favorites_user_listing_uidx").on(table.userId, table.listingId),
    index("favorites_user_idx").on(table.userId),
    index("favorites_listing_idx").on(table.listingId),
  ],
);

export const listingFinancingOptions = pgTable(
  "listing_financing_options",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    option: financingOptionEnum("option").notNull(),
  },
  (table) => [uniqueIndex("listing_financing_uidx").on(table.listingId, table.option)],
);

export const listingMedia = pgTable(
  "listing_media",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isCover: boolean("is_cover").notNull().default(false),
    altText: text("alt_text"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("listing_media_listing_idx").on(table.listingId)],
);

export const listingDocuments = pgTable(
  "listing_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    kind: documentKindEnum("kind").notNull().default("other"),
    visibility: text("visibility").notNull().default("admin_only"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("listing_documents_listing_idx").on(table.listingId)],
);

export const listingStatusEvents = pgTable(
  "listing_status_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    fromStatus: listingStatusEnum("from_status"),
    toStatus: listingStatusEnum("to_status").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("listing_status_events_listing_idx").on(table.listingId)],
);

export const moderationCases = pgTable(
  "moderation_cases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    queueStatus: moderationQueueStatusEnum("queue_status").notNull().default("pending"),
    assigneeUserId: uuid("assignee_user_id").references(() => users.id, { onDelete: "set null" }),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (table) => [
    index("moderation_cases_listing_idx").on(table.listingId),
    index("moderation_cases_queue_idx").on(table.queueStatus),
  ],
);

export const moderationDecisions = pgTable("moderation_decisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  caseId: uuid("case_id")
    .notNull()
    .references(() => moderationCases.id, { onDelete: "cascade" }),
  actorUserId: uuid("actor_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  outcome: moderationOutcomeEnum("outcome").notNull(),
  noteToLister: text("note_to_lister"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const inquiryStatusEnum = pgEnum("inquiry_status", [
  "new",
  "contacted",
  "qualified",
  "viewing_scheduled",
  "converted",
  "closed",
  "lost",
]);

export const appointmentStatusEnum = pgEnum("appointment_status", [
  "requested",
  "confirmed",
  "reschedule_requested",
  "cancelled",
  "completed",
  "declined",
]);

export const notificationChannelEnum = pgEnum("notification_channel", ["in_app", "email"]);

export const inquiries = pgTable(
  "inquiries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "restrict" }),
    customerUserId: uuid("customer_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    assigneeUserId: uuid("assignee_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: inquiryStatusEnum("status").notNull().default("new"),
    message: text("message").notNull(),
    contactName: text("contact_name").notNull(),
    contactPhone: text("contact_phone"),
    source: text("source").notNull().default("listing_detail"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("inquiries_listing_idx").on(table.listingId),
    index("inquiries_customer_idx").on(table.customerUserId),
    index("inquiries_assignee_status_idx").on(table.assigneeUserId, table.status),
  ],
);

export const inquiryMessages = pgTable(
  "inquiry_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    inquiryId: uuid("inquiry_id")
      .notNull()
      .references(() => inquiries.id, { onDelete: "cascade" }),
    senderUserId: uuid("sender_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("inquiry_messages_inquiry_idx").on(table.inquiryId)],
);

export const inquiryStatusEvents = pgTable(
  "inquiry_status_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    inquiryId: uuid("inquiry_id")
      .notNull()
      .references(() => inquiries.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    fromStatus: inquiryStatusEnum("from_status"),
    toStatus: inquiryStatusEnum("to_status").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("inquiry_status_events_inquiry_idx").on(table.inquiryId)],
);

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    inquiryId: uuid("inquiry_id")
      .notNull()
      .references(() => inquiries.id, { onDelete: "cascade" }),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "restrict" }),
    customerUserId: uuid("customer_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    hostUserId: uuid("host_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: appointmentStatusEnum("status").notNull().default("requested"),
    contactPhone: text("contact_phone"),
    note: text("note"),
    proposedStartsAt: timestamp("proposed_starts_at", { withTimezone: true }),
    proposedEndsAt: timestamp("proposed_ends_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("appointments_inquiry_idx").on(table.inquiryId),
    index("appointments_listing_idx").on(table.listingId),
    index("appointments_host_status_starts_idx").on(table.hostUserId, table.status, table.startsAt),
    index("appointments_listing_status_starts_idx").on(table.listingId, table.status, table.startsAt),
  ],
);

export const appointmentStatusEvents = pgTable(
  "appointment_status_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    fromStatus: appointmentStatusEnum("from_status"),
    toStatus: appointmentStatusEnum("to_status").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("appointment_status_events_appointment_idx").on(table.appointmentId)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channel: notificationChannelEnum("channel").notNull().default("in_app"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("notifications_user_idx").on(table.userId),
    index("notifications_user_unread_idx").on(table.userId, table.readAt),
  ],
);

export const listingReportStatusEnum = pgEnum("listing_report_status", [
  "open",
  "reviewing",
  "resolved",
  "dismissed",
]);

export const listingReports = pgTable(
  "listing_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    reporterUserId: uuid("reporter_user_id").references(() => users.id, { onDelete: "set null" }),
    reason: text("reason").notNull(),
    details: text("details"),
    status: listingReportStatusEnum("status").notNull().default("open"),
    resolverUserId: uuid("resolver_user_id").references(() => users.id, { onDelete: "set null" }),
    resolutionNote: text("resolution_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("listing_reports_listing_idx").on(table.listingId),
    index("listing_reports_status_idx").on(table.status),
  ],
);

export type UserRole = (typeof roleEnum.enumValues)[number];
export type UserStatus = (typeof userStatusEnum.enumValues)[number];
export type ListingStatus = (typeof listingStatusEnum.enumValues)[number];
export type ListingCategory = (typeof listingCategoryEnum.enumValues)[number];
export type ListingTransaction = (typeof listingTransactionEnum.enumValues)[number];
export type InquiryStatus = (typeof inquiryStatusEnum.enumValues)[number];
export type AppointmentStatus = (typeof appointmentStatusEnum.enumValues)[number];
