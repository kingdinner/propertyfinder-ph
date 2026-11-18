import { z } from "zod";

const optionalNonNeg = z.coerce.number().int().min(0).optional();
const optionalPositive = z.coerce.number().positive().optional();

export const searchQuerySchema = z
  .object({
    transaction: z.enum(["sale", "rent"]).optional(),
    category: z.enum(["house_lot", "condo", "townhouse", "lot", "commercial"]).optional(),
    q: z.string().trim().max(120).optional(),
    province: z.string().trim().max(80).optional(),
    city: z.string().trim().max(80).optional(),
    barangay: z.string().trim().max(80).optional(),
    minPrice: optionalNonNeg,
    maxPrice: optionalNonNeg,
    bedrooms: optionalNonNeg,
    bathrooms: optionalNonNeg,
    minFloorArea: optionalPositive,
    maxFloorArea: optionalPositive,
    minLotArea: optionalPositive,
    maxLotArea: optionalPositive,
    parking: optionalNonNeg,
    furnishing: z.enum(["unfurnished", "semi_furnished", "furnished"]).optional(),
    availability: z.enum(["rfo", "preselling", "resale"]).optional(),
    sort: z.enum(["newest", "price_asc", "price_desc", "beds_desc"]).default("newest"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(48).default(12),
    west: z.coerce.number().min(-180).max(180).optional(),
    south: z.coerce.number().min(-90).max(90).optional(),
    east: z.coerce.number().min(-180).max(180).optional(),
    north: z.coerce.number().min(-90).max(90).optional(),
    view: z.enum(["grid", "list", "map"]).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.minPrice != null && data.maxPrice != null && data.minPrice > data.maxPrice) {
      ctx.addIssue({ code: "custom", message: "minPrice cannot exceed maxPrice", path: ["minPrice"] });
    }
    if (data.minFloorArea != null && data.maxFloorArea != null && data.minFloorArea > data.maxFloorArea) {
      ctx.addIssue({
        code: "custom",
        message: "minFloorArea cannot exceed maxFloorArea",
        path: ["minFloorArea"],
      });
    }
    if (data.minLotArea != null && data.maxLotArea != null && data.minLotArea > data.maxLotArea) {
      ctx.addIssue({ code: "custom", message: "minLotArea cannot exceed maxLotArea", path: ["minLotArea"] });
    }
    const bbox = [data.west, data.south, data.east, data.north];
    const present = bbox.filter((value) => value != null).length;
    if (present > 0 && present < 4) {
      ctx.addIssue({ code: "custom", message: "Bounding box requires west,south,east,north", path: ["west"] });
    }
    if (present === 4 && (data.west! > data.east! || data.south! > data.north!)) {
      ctx.addIssue({ code: "custom", message: "Invalid bounding box range", path: ["west"] });
    }
    // Lot filters are only meaningful for land-capable categories when category is set.
    if (data.category === "condo" && (data.minLotArea != null || data.maxLotArea != null)) {
      ctx.addIssue({
        code: "custom",
        message: "Lot area does not apply to condominium listings",
        path: ["minLotArea"],
      });
    }
  });

export type SearchQuery = z.infer<typeof searchQuerySchema>;

export function parseSearchParams(input: Record<string, string | string[] | undefined> | URLSearchParams): SearchQuery {
  const raw: Record<string, string> = {};
  const entries =
    input instanceof URLSearchParams
      ? [...input.entries()]
      : Object.entries(input).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value] as const);
  for (const [key, value] of entries) {
    if (value == null || value === "" || value === "any") continue;
    raw[key] = value;
  }
  return searchQuerySchema.parse(raw);
}
