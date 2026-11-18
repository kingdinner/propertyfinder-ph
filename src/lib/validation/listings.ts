import { z } from "zod";

const financing = z.enum(["cash", "bank", "in_house", "pagibig"]);

const baseListingFields = {
  transaction: z.enum(["sale", "rent"]),
  category: z.enum(["house_lot", "condo", "townhouse", "lot", "commercial"]),
  title: z.string().trim().min(8).max(120),
  description: z.string().trim().max(8000).default(""),
  constructionStatus: z.enum(["rfo", "preselling", "resale"]).default("resale"),
  furnishing: z.enum(["unfurnished", "semi_furnished", "furnished"]).default("unfurnished"),
  bedrooms: z.number().int().min(0).max(50).default(0),
  bathrooms: z.number().int().min(0).max(50).default(0),
  powderRooms: z.number().int().min(0).max(20).default(0),
  parkingSlots: z.number().int().min(0).max(50).default(0),
  floorAreaSqm: z.number().positive().max(1_000_000).nullable().optional(),
  lotAreaSqm: z.number().positive().max(1_000_000).nullable().optional(),
  declaredTitleStatus: z
    .enum(["clean_tct_cct", "mortgaged", "tax_declaration", "estate_settlement", "unspecified"])
    .default("unspecified"),
  pricePhpCentavos: z.number().int().min(0).max(1_000_000_000_000),
  priceNegotiable: z.boolean().default(false),
  hoaDuesPhpCentavos: z.number().int().min(0).nullable().optional(),
  rptStatus: z.string().trim().max(120).nullable().optional(),
  province: z.string().trim().max(80).default(""),
  city: z.string().trim().max(80).default(""),
  barangay: z.string().trim().max(80).default(""),
  postalCode: z.string().trim().max(12).nullable().optional(),
  subdivision: z.string().trim().max(120).nullable().optional(),
  streetAddress: z.string().trim().max(200).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  brokerUserId: z.string().uuid().nullable().optional(),
  financingOptions: z.array(financing).default([]),
};

export const listingDraftSchema = z.object(baseListingFields).superRefine((data, ctx) => {
  applyCategoryRules(data, ctx, false);
  applyTransactionRules(data, ctx, false);
});

export const listingSubmitSchema = z.object(baseListingFields).superRefine((data, ctx) => {
  applyCategoryRules(data, ctx, true);
  applyTransactionRules(data, ctx, true);
  if (!data.province.trim()) ctx.addIssue({ code: "custom", message: "Province is required", path: ["province"] });
  if (!data.city.trim()) ctx.addIssue({ code: "custom", message: "City is required", path: ["city"] });
  if (!data.barangay.trim()) ctx.addIssue({ code: "custom", message: "Barangay is required", path: ["barangay"] });
  if (!data.description.trim() || data.description.trim().length < 40) {
    ctx.addIssue({ code: "custom", message: "Description must be at least 40 characters", path: ["description"] });
  }
  if (data.pricePhpCentavos < 100_000) {
    ctx.addIssue({
      code: "custom",
      message: data.transaction === "rent" ? "Monthly rent looks too low" : "Asking price looks too low",
      path: ["pricePhpCentavos"],
    });
  }
});

function applyCategoryRules(
  data: z.infer<typeof listingDraftSchema>,
  ctx: z.RefinementCtx,
  strict: boolean,
) {
  if (!strict) return;
  if (data.category === "lot") {
    if (!data.lotAreaSqm) ctx.addIssue({ code: "custom", message: "Lot area is required", path: ["lotAreaSqm"] });
  } else if (data.category === "commercial") {
    if (!data.floorAreaSqm) ctx.addIssue({ code: "custom", message: "Floor area is required", path: ["floorAreaSqm"] });
  } else if (data.category === "condo") {
    if (data.bedrooms < 0) ctx.addIssue({ code: "custom", message: "Bedrooms required", path: ["bedrooms"] });
    if (!data.floorAreaSqm) ctx.addIssue({ code: "custom", message: "Floor area is required", path: ["floorAreaSqm"] });
  } else {
    if (data.bedrooms < 1) ctx.addIssue({ code: "custom", message: "At least 1 bedroom is required", path: ["bedrooms"] });
    if (!data.floorAreaSqm) ctx.addIssue({ code: "custom", message: "Floor area is required", path: ["floorAreaSqm"] });
    if (!data.lotAreaSqm) ctx.addIssue({ code: "custom", message: "Lot area is required", path: ["lotAreaSqm"] });
  }
}

function applyTransactionRules(
  data: z.infer<typeof listingDraftSchema>,
  ctx: z.RefinementCtx,
  strict: boolean,
) {
  if (data.transaction === "rent") {
    if (data.financingOptions.length > 0) {
      ctx.addIssue({
        code: "custom",
        message: "Financing options apply to sale listings only",
        path: ["financingOptions"],
      });
    }
  }
  if (data.transaction === "sale" && strict && data.financingOptions.length === 0) {
    ctx.addIssue({
      code: "custom",
      message: "Select at least one accepted payment option for sale listings",
      path: ["financingOptions"],
    });
  }
}

export const moderationDecisionSchema = z.object({
  outcome: z.enum(["approve", "request_changes", "reject"]),
  noteToLister: z.string().trim().max(2000).optional(),
}).superRefine((data, ctx) => {
  if ((data.outcome === "request_changes" || data.outcome === "reject") && !data.noteToLister?.trim()) {
    ctx.addIssue({ code: "custom", message: "A reason is required", path: ["noteToLister"] });
  }
});

export const assignBrokerSchema = z.object({
  brokerUserId: z.string().uuid().nullable(),
});
