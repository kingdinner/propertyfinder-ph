export type ListingFormState = {
  transaction: "sale" | "rent";
  category: "house_lot" | "condo" | "townhouse" | "lot" | "commercial";
  title: string;
  description: string;
  constructionStatus: "rfo" | "preselling" | "resale";
  furnishing: "unfurnished" | "semi_furnished" | "furnished";
  bedrooms: number;
  bathrooms: number;
  powderRooms: number;
  parkingSlots: number;
  floorAreaSqm: number | null;
  lotAreaSqm: number | null;
  declaredTitleStatus:
    | "clean_tct_cct"
    | "mortgaged"
    | "tax_declaration"
    | "estate_settlement"
    | "unspecified";
  pricePhp: string;
  priceNegotiable: boolean;
  hoaDuesPhp: string;
  rptStatus: string;
  province: string;
  city: string;
  barangay: string;
  postalCode: string;
  subdivision: string;
  streetAddress: string;
  financingOptions: Array<"cash" | "bank" | "in_house" | "pagibig">;
  brokerUserId: string;
};

export const emptyListingForm = (): ListingFormState => ({
  transaction: "sale",
  category: "house_lot",
  title: "",
  description: "",
  constructionStatus: "resale",
  furnishing: "unfurnished",
  bedrooms: 0,
  bathrooms: 0,
  powderRooms: 0,
  parkingSlots: 0,
  floorAreaSqm: null,
  lotAreaSqm: null,
  declaredTitleStatus: "unspecified",
  pricePhp: "",
  priceNegotiable: false,
  hoaDuesPhp: "",
  rptStatus: "",
  province: "",
  city: "",
  barangay: "",
  postalCode: "",
  subdivision: "",
  streetAddress: "",
  financingOptions: [],
  brokerUserId: "",
});

export function pesosToCentavos(value: string) {
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) return 0;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return Math.round(amount * 100);
}

export function centavosToPesos(centavos: number) {
  return (centavos / 100).toFixed(centavos % 100 === 0 ? 0 : 2);
}

export function formToPayload(form: ListingFormState) {
  return {
    transaction: form.transaction,
    category: form.category,
    title: form.title,
    description: form.description,
    constructionStatus: form.constructionStatus,
    furnishing: form.furnishing,
    bedrooms: form.bedrooms,
    bathrooms: form.bathrooms,
    powderRooms: form.powderRooms,
    parkingSlots: form.parkingSlots,
    floorAreaSqm: form.floorAreaSqm,
    lotAreaSqm: form.lotAreaSqm,
    declaredTitleStatus: form.declaredTitleStatus,
    pricePhpCentavos: pesosToCentavos(form.pricePhp),
    priceNegotiable: form.priceNegotiable,
    hoaDuesPhpCentavos: form.hoaDuesPhp ? pesosToCentavos(form.hoaDuesPhp) : null,
    rptStatus: form.rptStatus || null,
    province: form.province,
    city: form.city,
    barangay: form.barangay,
    postalCode: form.postalCode || null,
    subdivision: form.subdivision || null,
    streetAddress: form.streetAddress || null,
    financingOptions: form.transaction === "sale" ? form.financingOptions : [],
    brokerUserId: form.brokerUserId || null,
  };
}

export function listingToForm(listing: {
  transaction: ListingFormState["transaction"];
  category: ListingFormState["category"];
  title: string;
  description: string;
  constructionStatus: ListingFormState["constructionStatus"];
  furnishing: ListingFormState["furnishing"];
  bedrooms: number;
  bathrooms: number;
  powderRooms: number;
  parkingSlots: number;
  floorAreaSqm: number | null;
  lotAreaSqm: number | null;
  declaredTitleStatus: ListingFormState["declaredTitleStatus"];
  pricePhpCentavos: number;
  priceNegotiable: boolean;
  hoaDuesPhpCentavos: number | null;
  rptStatus: string | null;
  province: string;
  city: string;
  barangay: string;
  postalCode: string | null;
  subdivision: string | null;
  streetAddress: string | null;
  financingOptions: ListingFormState["financingOptions"];
  brokerUserId: string | null;
}): ListingFormState {
  return {
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
    floorAreaSqm: listing.floorAreaSqm,
    lotAreaSqm: listing.lotAreaSqm,
    declaredTitleStatus: listing.declaredTitleStatus,
    pricePhp: centavosToPesos(listing.pricePhpCentavos),
    priceNegotiable: listing.priceNegotiable,
    hoaDuesPhp: listing.hoaDuesPhpCentavos != null ? centavosToPesos(listing.hoaDuesPhpCentavos) : "",
    rptStatus: listing.rptStatus ?? "",
    province: listing.province,
    city: listing.city,
    barangay: listing.barangay,
    postalCode: listing.postalCode ?? "",
    subdivision: listing.subdivision ?? "",
    streetAddress: listing.streetAddress ?? "",
    financingOptions: listing.financingOptions,
    brokerUserId: listing.brokerUserId ?? "",
  };
}

export function showsBedrooms(category: ListingFormState["category"]) {
  return category !== "lot" && category !== "commercial";
}

export function showsFloorArea(category: ListingFormState["category"]) {
  return category !== "lot";
}

export function showsLotArea(category: ListingFormState["category"]) {
  return category === "lot" || category === "house_lot" || category === "townhouse";
}
