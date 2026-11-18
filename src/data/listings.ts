/** Demo fixtures for foundation UI tests only. Production search reads published rows from Postgres. */

export type Transaction = "sale" | "rent";

export type ListingCategory = "house_lot" | "condo" | "townhouse" | "lot" | "commercial";

export type Listing = {
  id: string;
  title: string;
  transaction: Transaction;
  category: ListingCategory;
  priceCentavos: number;
  location: string;
  city: string;
  bedrooms: number;
  bathrooms: number;
  floorAreaSqm: number;
  parking: number;
  broker: string;
  prcLicense: string;
  badge: string;
  tone: "sale" | "rent" | "review";
};

export const categoryLabel: Record<ListingCategory, string> = {
  house_lot: "House & Lot",
  condo: "Condominium",
  townhouse: "Townhouse",
  lot: "Vacant lot",
  commercial: "Commercial",
};

export const listings: Listing[] = [
  {
    id: "pf-lipa-4br",
    title: "Modern 4-bedroom villa with garden",
    transaction: "sale",
    category: "house_lot",
    priceCentavos: 1_480_000_000,
    location: "Malarayat Hills, Lipa City, Batangas",
    city: "Lipa City",
    bedrooms: 4,
    bathrooms: 3,
    floorAreaSqm: 220,
    parking: 2,
    broker: "Maria Santos, REB",
    prcLicense: "PRC #0029841",
    badge: "Declared clean title",
    tone: "sale",
  },
  {
    id: "pf-bgc-2br",
    title: "The Suites at One Bonifacio",
    transaction: "sale",
    category: "condo",
    priceCentavos: 1_285_000_000,
    location: "Bonifacio High Street, Taguig",
    city: "Taguig",
    bedrooms: 2,
    bathrooms: 2,
    floorAreaSqm: 90,
    parking: 1,
    broker: "Ayala Land Premier Rep",
    prcLicense: "PRC #0028194",
    badge: "Ready for occupancy",
    tone: "sale",
  },
  {
    id: "pf-makati-1br",
    title: "Boutique 1-bedroom high-floor residence",
    transaction: "rent",
    category: "condo",
    priceCentavos: 6_500_000,
    location: "Salcedo Village, Makati",
    city: "Makati",
    bedrooms: 1,
    bathrooms: 1,
    floorAreaSqm: 58,
    parking: 0,
    broker: "Jonathan Dee",
    prcLicense: "PRC #0017402",
    badge: "For rent",
    tone: "rent",
  },
  {
    id: "pf-calapan-villa",
    title: "Coastal garden villa and lot",
    transaction: "sale",
    category: "house_lot",
    priceCentavos: 690_000_000,
    location: "Suqui, Calapan City, Oriental Mindoro",
    city: "Calapan",
    bedrooms: 3,
    bathrooms: 2,
    floorAreaSqm: 160,
    parking: 1,
    broker: "Elena Aquino",
    prcLicense: "PRC #0031980",
    badge: "Awaiting review",
    tone: "review",
  },
];

export type ListingFilters = {
  transaction?: Transaction | "any";
  category?: ListingCategory | "any";
  city?: string;
  minBedrooms?: number;
};

export function filterListings(source: Listing[], filters: ListingFilters): Listing[] {
  return source.filter((listing) => {
    if (filters.transaction && filters.transaction !== "any" && listing.transaction !== filters.transaction) {
      return false;
    }
    if (filters.category && filters.category !== "any" && listing.category !== filters.category) {
      return false;
    }
    if (filters.city && filters.city !== "any" && listing.city !== filters.city) {
      return false;
    }
    if (filters.minBedrooms && listing.bedrooms < filters.minBedrooms) {
      return false;
    }
    return true;
  });
}

export function getListing(id: string): Listing | undefined {
  return listings.find((listing) => listing.id === id);
}
