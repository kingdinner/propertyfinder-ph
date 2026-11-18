export const categoryLabel: Record<
  "house_lot" | "condo" | "townhouse" | "lot" | "commercial",
  string
> = {
  house_lot: "House & Lot",
  condo: "Condominium",
  townhouse: "Townhouse",
  lot: "Vacant lot",
  commercial: "Commercial",
};

export const furnishingLabel = {
  unfurnished: "Unfurnished",
  semi_furnished: "Semi-furnished",
  furnished: "Furnished",
} as const;

export const availabilityLabel = {
  rfo: "Ready for occupancy",
  preselling: "Pre-selling",
  resale: "Resale / available",
} as const;

export function searchParamsToObject(params: URLSearchParams) {
  const object: Record<string, string> = {};
  params.forEach((value, key) => {
    object[key] = value;
  });
  return object;
}

export function buildSearchQueryString(
  current: URLSearchParams | Record<string, string | undefined>,
  patch: Record<string, string | number | undefined | null>,
) {
  const params = new URLSearchParams(
    current instanceof URLSearchParams ? current : Object.entries(current).filter(([, v]) => v != null && v !== "") as [string, string][],
  );
  for (const [key, value] of [...params.entries()]) {
    if (value === "" || value === "any") params.delete(key);
  }
  for (const [key, value] of Object.entries(patch)) {
    if (value == null || value === "" || value === "any" || (value === 0 && key !== "page")) {
      params.delete(key);
    } else {
      params.set(key, String(value));
    }
  }
  if (params.get("page") === "1") params.delete("page");
  return params.toString();
}

export type Chip = { key: string; label: string; clear: Record<string, null> };

export function activeFilterChips(filters: {
  transaction?: string;
  category?: string;
  q?: string;
  province?: string;
  city?: string;
  barangay?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  bathrooms?: number;
  minFloorArea?: number;
  maxFloorArea?: number;
  minLotArea?: number;
  maxLotArea?: number;
  parking?: number;
  furnishing?: string;
  availability?: string;
}): Chip[] {
  const chips: Chip[] = [];
  // Buy/Rent is controlled by the segmented control — omit it from dismissible chips.
  if (filters.category) {
    chips.push({
      key: "category",
      label: categoryLabel[filters.category as keyof typeof categoryLabel] ?? filters.category,
      clear: { category: null, minLotArea: null, maxLotArea: null },
    });
  }
  if (filters.q) chips.push({ key: "q", label: `“${filters.q}”`, clear: { q: null } });
  if (filters.province) chips.push({ key: "province", label: filters.province, clear: { province: null } });
  if (filters.city) chips.push({ key: "city", label: filters.city, clear: { city: null } });
  if (filters.barangay) chips.push({ key: "barangay", label: filters.barangay, clear: { barangay: null } });
  if (filters.minPrice != null || filters.maxPrice != null) {
    chips.push({
      key: "price",
      label: `₱${filters.minPrice ?? 0}–${filters.maxPrice ?? "∞"}`,
      clear: { minPrice: null, maxPrice: null },
    });
  }
  if (filters.bedrooms != null) {
    chips.push({ key: "bedrooms", label: `${filters.bedrooms}+ beds`, clear: { bedrooms: null } });
  }
  if (filters.bathrooms != null) {
    chips.push({ key: "bathrooms", label: `${filters.bathrooms}+ baths`, clear: { bathrooms: null } });
  }
  if (filters.minFloorArea != null || filters.maxFloorArea != null) {
    chips.push({
      key: "floor",
      label: `Floor ${filters.minFloorArea ?? 0}–${filters.maxFloorArea ?? "∞"} sqm`,
      clear: { minFloorArea: null, maxFloorArea: null },
    });
  }
  if (filters.minLotArea != null || filters.maxLotArea != null) {
    chips.push({
      key: "lot",
      label: `Lot ${filters.minLotArea ?? 0}–${filters.maxLotArea ?? "∞"} sqm`,
      clear: { minLotArea: null, maxLotArea: null },
    });
  }
  if (filters.parking != null) {
    chips.push({ key: "parking", label: `${filters.parking}+ parking`, clear: { parking: null } });
  }
  if (filters.furnishing) {
    chips.push({
      key: "furnishing",
      label: furnishingLabel[filters.furnishing as keyof typeof furnishingLabel] ?? filters.furnishing,
      clear: { furnishing: null },
    });
  }
  if (filters.availability) {
    chips.push({
      key: "availability",
      label: availabilityLabel[filters.availability as keyof typeof availabilityLabel] ?? filters.availability,
      clear: { availability: null },
    });
  }
  return chips;
}
