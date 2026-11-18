import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq, inArray } from "drizzle-orm";
import { createDb } from "@/db/client";
import {
  appointments,
  brokerProfiles,
  favorites,
  inquiries,
  inquiryMessages,
  listingFinancingOptions,
  listingMedia,
  listingReports,
  listings,
  listingStatusEvents,
  moderationCases,
  userRoles,
  users,
} from "@/db/schema";
import { hashPassword } from "@/lib/auth/crypto";

/** Tiny valid 1×1 JPEG fallback if image download fails. */
function fallbackJpeg() {
  return Buffer.from(
    "ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707070909080a0c140c0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffdb0043010909090c0b0c180d0d1832211c213232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232ffc00011080001000103011100021101031101ffc40014000100000000000000000000000000000000ffc40014100100000000000000000000000000000000ffda000c0301000210031000003f00bf80ffd9",
    "hex",
  );
}

const DEMO_COVER_URLS: Record<string, string> = {
  "PF-LIPA-4BR": "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1200&q=80",
  "PF-BGC-2BR": "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80",
  "PF-MAK-1BR": "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80",
  "PF-CAL-3BR": "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80",
  "PF-CEB-LOT": "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80",
  "PF-QC-TH": "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=80",
  "PF-PENDING-1": "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1200&q=80",
  "PF-DRAFT-1": "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80",
};

async function writeDemoCover(storageKey: string, publicCode: string) {
  const full = path.join(process.cwd(), "uploads", storageKey);
  await mkdir(path.dirname(full), { recursive: true });
  const source = DEMO_COVER_URLS[publicCode];
  if (!source) {
    await writeFile(full, fallbackJpeg());
    return;
  }
  try {
    const response = await fetch(source, { redirect: "follow" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength < 1000) throw new Error("Image too small");
    await writeFile(full, bytes);
  } catch (error) {
    console.warn(`Cover download failed for ${publicCode}, using fallback:`, error);
    await writeFile(full, fallbackJpeg());
  }
}

const DEMO_PASSWORD = "DemoPass1!";

type DemoUser = {
  email: string;
  fullName: string;
  role: "CUSTOMER" | "PROPERTY_OWNER" | "REAL_ESTATE_AGENT" | "ADMIN";
  phone?: string;
  broker?: {
    displayName: string;
    agencyName: string;
    prcLicenseNo: string;
  };
};

const demoUsers: DemoUser[] = [
  {
    email: "admin@propertyfinder.ph",
    fullName: "Platform Admin",
    role: "ADMIN",
  },
  {
    email: "alex.mercado@example.com",
    fullName: "Alex Mercado",
    role: "CUSTOMER",
    phone: "+639188201111",
  },
  {
    email: "owner.lipa@example.com",
    fullName: "Rosa Villanueva",
    role: "PROPERTY_OWNER",
    phone: "+639171112233",
  },
  {
    email: "maria.santos@example.com",
    fullName: "Maria Santos",
    role: "REAL_ESTATE_AGENT",
    phone: "+639175551010",
    broker: {
      displayName: "Maria Santos, REB",
      agencyName: "Santos Premier Realty",
      prcLicenseNo: "0029841",
    },
  },
  {
    email: "jonathan.dee@example.com",
    fullName: "Jonathan Dee",
    role: "REAL_ESTATE_AGENT",
    phone: "+639176667788",
    broker: {
      displayName: "Jonathan Dee",
      agencyName: "Dee Property Advisors",
      prcLicenseNo: "0017402",
    },
  },
];

async function upsertUser(
  db: ReturnType<typeof createDb>,
  input: DemoUser,
  passwordHash: string,
) {
  const [existing] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  let userId: string;
  if (existing) {
    userId = existing.id;
    await db
      .update(users)
      .set({
        fullName: input.fullName,
        phoneE164: input.phone ?? null,
        passwordHash,
        emailVerifiedAt: new Date(),
        status: "active",
        activePortal: input.role,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  } else {
    const [created] = await db
      .insert(users)
      .values({
        email: input.email,
        passwordHash,
        fullName: input.fullName,
        phoneE164: input.phone ?? null,
        emailVerifiedAt: new Date(),
        status: "active",
        activePortal: input.role,
      })
      .returning();
    userId = created.id;
  }

  await db.delete(userRoles).where(eq(userRoles.userId, userId));
  await db.insert(userRoles).values({ userId, role: input.role });

  if (input.broker) {
    const [profile] = await db.select().from(brokerProfiles).where(eq(brokerProfiles.userId, userId)).limit(1);
    if (profile) {
      await db
        .update(brokerProfiles)
        .set({
          displayName: input.broker.displayName,
          agencyName: input.broker.agencyName,
          prcLicenseNo: input.broker.prcLicenseNo,
          licenseReviewStatus: "accepted",
          updatedAt: new Date(),
        })
        .where(eq(brokerProfiles.userId, userId));
    } else {
      await db.insert(brokerProfiles).values({
        userId,
        displayName: input.broker.displayName,
        agencyName: input.broker.agencyName,
        prcLicenseNo: input.broker.prcLicenseNo,
        licenseReviewStatus: "accepted",
      });
    }
  }

  return userId;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const db = createDb(databaseUrl);
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const adminHash = await hashPassword("ChangeMeAdmin1!");

  const ids: Record<string, string> = {};
  for (const user of demoUsers) {
    const hash = user.role === "ADMIN" ? adminHash : passwordHash;
    ids[user.email] = await upsertUser(db, user, hash);
  }

  // Clear previous demo listings and related rows (keep users).
  const demoCodes = [
    "PF-LIPA-4BR",
    "PF-BGC-2BR",
    "PF-MAK-1BR",
    "PF-CAL-3BR",
    "PF-CEB-LOT",
    "PF-QC-TH",
    "PF-PENDING-1",
    "PF-DRAFT-1",
  ];
  const existingListings = await db.select({ id: listings.id }).from(listings).where(inArray(listings.publicCode, demoCodes));
  const listingIds = existingListings.map((row) => row.id);
  if (listingIds.length > 0) {
    const relatedInquiries = await db
      .select({ id: inquiries.id })
      .from(inquiries)
      .where(inArray(inquiries.listingId, listingIds));
    const inquiryIds = relatedInquiries.map((row) => row.id);
    if (inquiryIds.length > 0) {
      await db.delete(appointments).where(inArray(appointments.inquiryId, inquiryIds));
      await db.delete(inquiryMessages).where(inArray(inquiryMessages.inquiryId, inquiryIds));
      await db.delete(inquiries).where(inArray(inquiries.id, inquiryIds));
    }
    await db.delete(appointments).where(inArray(appointments.listingId, listingIds));
    await db.delete(listingReports).where(inArray(listingReports.listingId, listingIds));
    await db.delete(favorites).where(inArray(favorites.listingId, listingIds));
    await db.delete(listings).where(inArray(listings.id, listingIds));
  }

  const ownerId = ids["owner.lipa@example.com"]!;
  const mariaId = ids["maria.santos@example.com"]!;
  const jonathanId = ids["jonathan.dee@example.com"]!;
  const alexId = ids["alex.mercado@example.com"]!;

  const now = new Date();
  const catalog = [
    {
      publicCode: "PF-LIPA-4BR",
      ownerUserId: ownerId,
      brokerUserId: mariaId,
      transaction: "sale" as const,
      category: "house_lot" as const,
      title: "Modern 4-bedroom villa with garden",
      description:
        "Spacious house and lot in Malarayat Hills, Lipa City. Quiet cul-de-sac, covered parking for two cars, and a landscaped garden ready for weekends with family.",
      constructionStatus: "resale" as const,
      furnishing: "semi_furnished" as const,
      bedrooms: 4,
      bathrooms: 3,
      powderRooms: 1,
      parkingSlots: 2,
      floorAreaSqm: "220",
      lotAreaSqm: "450",
      declaredTitleStatus: "clean_tct_cct" as const,
      pricePhpCentavos: 1_480_000_000,
      priceNegotiable: true,
      province: "Batangas",
      city: "Lipa City",
      barangay: "San Sebastian",
      subdivision: "Malarayat Hills",
      streetAddress: "Lot 12 Block 3",
      postalCode: "4217",
      lat: 13.9411,
      lng: 121.1631,
      status: "published" as const,
      publishedAt: now,
      financing: ["cash", "bank", "pagibig"] as const,
    },
    {
      publicCode: "PF-BGC-2BR",
      ownerUserId: ownerId,
      brokerUserId: mariaId,
      transaction: "sale" as const,
      category: "condo" as const,
      title: "The Suites at One Bonifacio",
      description:
        "Bright 2-bedroom condominium steps from Bonifacio High Street. Floor-to-ceiling windows, one parking slot, and building amenities including a lap pool and coworking lounge.",
      constructionStatus: "rfo" as const,
      furnishing: "furnished" as const,
      bedrooms: 2,
      bathrooms: 2,
      powderRooms: 0,
      parkingSlots: 1,
      floorAreaSqm: "90",
      lotAreaSqm: null,
      declaredTitleStatus: "clean_tct_cct" as const,
      pricePhpCentavos: 1_285_000_000,
      priceNegotiable: false,
      province: "Metro Manila",
      city: "Taguig",
      barangay: "Fort Bonifacio",
      subdivision: "Bonificio Global City",
      streetAddress: "5th Avenue",
      postalCode: "1634",
      lat: 14.5515,
      lng: 121.048,
      status: "published" as const,
      publishedAt: now,
      financing: ["bank", "cash"] as const,
    },
    {
      publicCode: "PF-MAK-1BR",
      ownerUserId: ownerId,
      brokerUserId: jonathanId,
      transaction: "rent" as const,
      category: "condo" as const,
      title: "Boutique 1-bedroom high-floor residence",
      description:
        "Fully furnished 1-bedroom rental in Salcedo Village, Makati. Ideal for professionals who want walkable access to cafes, groceries, and office towers.",
      constructionStatus: "resale" as const,
      furnishing: "furnished" as const,
      bedrooms: 1,
      bathrooms: 1,
      powderRooms: 0,
      parkingSlots: 0,
      floorAreaSqm: "58",
      lotAreaSqm: null,
      declaredTitleStatus: "unspecified" as const,
      pricePhpCentavos: 6_500_000,
      priceNegotiable: true,
      province: "Metro Manila",
      city: "Makati",
      barangay: "Bel-Air",
      subdivision: "Salcedo Village",
      streetAddress: "HV Dela Costa",
      postalCode: "1227",
      lat: 14.5605,
      lng: 121.0244,
      status: "published" as const,
      publishedAt: now,
      financing: [] as const,
    },
    {
      publicCode: "PF-CAL-3BR",
      ownerUserId: ownerId,
      brokerUserId: mariaId,
      transaction: "sale" as const,
      category: "house_lot" as const,
      title: "Coastal garden villa and lot",
      description:
        "Three-bedroom coastal villa in Suqui, Calapan City with a generous lot, fruit trees, and easy access to the pier for weekend island trips.",
      constructionStatus: "resale" as const,
      furnishing: "unfurnished" as const,
      bedrooms: 3,
      bathrooms: 2,
      powderRooms: 0,
      parkingSlots: 1,
      floorAreaSqm: "160",
      lotAreaSqm: "520",
      declaredTitleStatus: "tax_declaration" as const,
      pricePhpCentavos: 690_000_000,
      priceNegotiable: true,
      province: "Oriental Mindoro",
      city: "Calapan",
      barangay: "Suqui",
      subdivision: null,
      streetAddress: "Coastal Road",
      postalCode: "5200",
      lat: 13.4105,
      lng: 121.1803,
      status: "published" as const,
      publishedAt: now,
      financing: ["cash", "in_house"] as const,
    },
    {
      publicCode: "PF-CEB-LOT",
      ownerUserId: ownerId,
      brokerUserId: jonathanId,
      transaction: "sale" as const,
      category: "lot" as const,
      title: "Elevated residential lot near IT Park",
      description:
        "Vacant residential lot with a gentle slope and wide frontage. Suitable for a modern home near Cebu IT Park and lifestyle centers.",
      constructionStatus: "resale" as const,
      furnishing: "unfurnished" as const,
      bedrooms: 0,
      bathrooms: 0,
      powderRooms: 0,
      parkingSlots: 0,
      floorAreaSqm: null,
      lotAreaSqm: "300",
      declaredTitleStatus: "clean_tct_cct" as const,
      pricePhpCentavos: 420_000_000,
      priceNegotiable: true,
      province: "Cebu",
      city: "Cebu City",
      barangay: "Lahug",
      subdivision: "Vista Heights",
      streetAddress: "Ridge Road",
      postalCode: "6000",
      lat: 10.3332,
      lng: 123.906,
      status: "published" as const,
      publishedAt: now,
      financing: ["cash", "bank"] as const,
    },
    {
      publicCode: "PF-QC-TH",
      ownerUserId: ownerId,
      brokerUserId: mariaId,
      transaction: "rent" as const,
      category: "townhouse" as const,
      title: "Family townhouse near Katipunan",
      description:
        "Three-bedroom townhouse for rent near Katipunan. Semi-furnished with a small yard, maid’s room, and two parking slots inside a gated community.",
      constructionStatus: "resale" as const,
      furnishing: "semi_furnished" as const,
      bedrooms: 3,
      bathrooms: 3,
      powderRooms: 1,
      parkingSlots: 2,
      floorAreaSqm: "145",
      lotAreaSqm: "90",
      declaredTitleStatus: "unspecified" as const,
      pricePhpCentavos: 8_500_000,
      priceNegotiable: false,
      province: "Metro Manila",
      city: "Quezon City",
      barangay: "Loyola Heights",
      subdivision: "University Village",
      streetAddress: "Esteban Abada",
      postalCode: "1108",
      lat: 14.637,
      lng: 121.0747,
      status: "published" as const,
      publishedAt: now,
      financing: [] as const,
    },
    {
      publicCode: "PF-PENDING-1",
      ownerUserId: ownerId,
      brokerUserId: mariaId,
      transaction: "sale" as const,
      category: "condo" as const,
      title: "Ortigas junior 1BR awaiting review",
      description:
        "Demo listing waiting in the moderation queue. It should not appear in public search until an admin approves it.",
      constructionStatus: "preselling" as const,
      furnishing: "unfurnished" as const,
      bedrooms: 1,
      bathrooms: 1,
      powderRooms: 0,
      parkingSlots: 1,
      floorAreaSqm: "32",
      lotAreaSqm: null,
      declaredTitleStatus: "unspecified" as const,
      pricePhpCentavos: 480_000_000,
      priceNegotiable: false,
      province: "Metro Manila",
      city: "Pasig",
      barangay: "San Antonio",
      subdivision: "Ortigas Center",
      streetAddress: "Julia Vargas",
      postalCode: "1605",
      lat: 14.586,
      lng: 121.062,
      status: "pending_review" as const,
      publishedAt: null,
      financing: ["bank"] as const,
    },
    {
      publicCode: "PF-DRAFT-1",
      ownerUserId: ownerId,
      brokerUserId: null,
      transaction: "sale" as const,
      category: "commercial" as const,
      title: "Draft corner commercial unit",
      description: "Incomplete draft commercial unit used for owner portal demos. Not submitted for review yet.",
      constructionStatus: "rfo" as const,
      furnishing: "unfurnished" as const,
      bedrooms: 0,
      bathrooms: 1,
      powderRooms: 0,
      parkingSlots: 2,
      floorAreaSqm: "110",
      lotAreaSqm: null,
      declaredTitleStatus: "unspecified" as const,
      pricePhpCentavos: 950_000_000,
      priceNegotiable: true,
      province: "Metro Manila",
      city: "Makati",
      barangay: "Poblacion",
      subdivision: null,
      streetAddress: "Kalayaan Avenue",
      postalCode: "1210",
      lat: 14.565,
      lng: 121.029,
      status: "draft" as const,
      publishedAt: null,
      financing: ["cash"] as const,
    },
  ];

  const createdByCode: Record<string, string> = {};
  for (const item of catalog) {
    const { financing, ...values } = item;
    const [row] = await db.insert(listings).values(values).returning();
    createdByCode[row.publicCode] = row.id;
    if (financing.length > 0) {
      await db.insert(listingFinancingOptions).values(
        financing.map((option) => ({ listingId: row.id, option })),
      );
    }
    await db.insert(listingStatusEvents).values({
      listingId: row.id,
      actorUserId: ownerId,
      fromStatus: null,
      toStatus: row.status,
      note: "Demo seed",
    });
    const storageKey = `demo/${row.publicCode.toLowerCase()}-cover.jpg`;
    await writeDemoCover(storageKey, row.publicCode);
    await db.insert(listingMedia).values({
      listingId: row.id,
      storageKey,
      mimeType: "image/jpeg",
      sortOrder: 0,
      isCover: true,
      altText: row.title,
    });
    if (row.status === "pending_review") {
      await db.insert(moderationCases).values({
        listingId: row.id,
        queueStatus: "pending",
      });
    }
  }

  const lipaId = createdByCode["PF-LIPA-4BR"]!;
  const bgcId = createdByCode["PF-BGC-2BR"]!;
  const makId = createdByCode["PF-MAK-1BR"]!;

  await db.delete(favorites).where(eq(favorites.userId, alexId));
  await db.insert(favorites).values([
    { userId: alexId, listingId: lipaId },
    { userId: alexId, listingId: bgcId },
    { userId: alexId, listingId: makId },
  ]);

  // Clear prior demo inquiries for alex on these listings
  const oldInquiries = await db.select({ id: inquiries.id }).from(inquiries).where(eq(inquiries.customerUserId, alexId));
  if (oldInquiries.length > 0) {
    await db.delete(inquiries).where(inArray(inquiries.id, oldInquiries.map((row) => row.id)));
  }

  const [inquiry] = await db
    .insert(inquiries)
    .values({
      listingId: lipaId,
      customerUserId: alexId,
      assigneeUserId: mariaId,
      status: "contacted",
      message: "Hi Maria, we are interested in a Saturday morning viewing of the Lipa villa.",
      contactName: "Alex Mercado",
      contactPhone: "+639188201111",
      source: "demo_seed",
    })
    .returning();
  await db.insert(inquiryMessages).values([
    {
      inquiryId: inquiry.id,
      senderUserId: alexId,
      body: "Hi Maria, we are interested in a Saturday morning viewing of the Lipa villa.",
    },
    {
      inquiryId: inquiry.id,
      senderUserId: mariaId,
      body: "Thanks Alex — Saturday 10:00 Asia/Manila works. I will confirm once you request the slot.",
    },
  ]);

  const startsAt = new Date(Date.now() + 3 * 24 * 3600_000);
  startsAt.setMinutes(0, 0, 0);
  const endsAt = new Date(startsAt.getTime() + 60 * 60_000);
  await db.insert(appointments).values({
    inquiryId: inquiry.id,
    listingId: lipaId,
    customerUserId: alexId,
    hostUserId: mariaId,
    startsAt,
    endsAt,
    status: "requested",
    contactPhone: "+639188201111",
    note: "Demo viewing request",
  });

  console.log("Demo data ready.");
  console.log("Accounts (password DemoPass1! except admin):");
  console.log("  admin@propertyfinder.ph / ChangeMeAdmin1!");
  console.log("  alex.mercado@example.com  (customer)");
  console.log("  owner.lipa@example.com    (owner)");
  console.log("  maria.santos@example.com  (agent)");
  console.log("  jonathan.dee@example.com  (agent)");
  console.log(`Published listings: 6 · Pending: 1 · Draft: 1`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
