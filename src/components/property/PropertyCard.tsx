import Link from "next/link";
import type { Listing } from "@/data/listings";
import { categoryLabel } from "@/data/listings";
import { formatArea, formatPeso } from "@/lib/format";

const toneClass = {
  sale: "bg-ok-soft text-ok",
  rent: "bg-amber-soft text-amber",
  review: "bg-surface-high text-ink",
} as const;

export type PropertyCardListing = Listing & {
  coverUrl?: string | null;
  isFavorited?: boolean;
};

export function PropertyCard({
  listing,
  layout = "grid",
  onToggleFavorite,
}: {
  listing: PropertyCardListing;
  layout?: "grid" | "row";
  onToggleFavorite?: (listingId: string, next: boolean) => void;
}) {
  const price = formatPeso(listing.priceCentavos, listing.transaction);
  const facts = `${listing.bedrooms} beds · ${listing.bathrooms} baths · ${formatArea(listing.floorAreaSqm)}`;
  const isRow = layout === "row";

  return (
    <article
      className={
        isRow
          ? "grid min-w-0 overflow-hidden rounded-xl border border-line bg-white sm:grid-cols-[200px_minmax(0,1fr)]"
          : "flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-white"
      }
    >
      <div
        className={
          isRow
            ? "relative aspect-[4/3] bg-surface-high sm:aspect-auto sm:min-h-[168px] sm:h-full"
            : "relative aspect-[4/3] w-full shrink-0 bg-surface-high"
        }
        aria-hidden
      >
        {listing.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listing.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-[linear-gradient(145deg,#d3e4fe,#131b2e)] opacity-90" />
        )}
        {!listing.coverUrl ? (
          <p className="absolute bottom-3 left-3 text-xs font-bold tracking-wide text-white">Photo pending</p>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${toneClass[listing.tone]}`}>{listing.badge}</span>
          <span className="shrink-0 text-[11px] font-semibold text-muted">{categoryLabel[listing.category]}</span>
        </div>
        <div className="min-w-0">
          <p className="text-xl font-extrabold tracking-tight text-ink">{price}</p>
          <h3 className="mt-1 truncate text-base font-bold text-ink">
            <Link href={`/listings/${listing.id}`} className="hover:text-amber">
              {listing.title}
            </Link>
          </h3>
          <p className="truncate text-sm text-muted">{listing.location}</p>
        </div>
        <p className="text-sm text-ink">{facts}</p>
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-3">
          <p className="min-w-0 truncate text-xs text-muted">
            <span className="block truncate font-bold text-ink">{listing.broker}</span>
            {listing.prcLicense}
          </p>
          <div className="flex shrink-0 items-center gap-3">
            {onToggleFavorite ? (
              <button
                type="button"
                className="text-sm font-bold text-ink"
                onClick={() => onToggleFavorite(listing.id, !listing.isFavorited)}
                aria-pressed={listing.isFavorited ? true : false}
              >
                {listing.isFavorited ? "Saved" : "Save"}
              </button>
            ) : null}
            <Link href={`/listings/${listing.id}`} className="text-sm font-bold text-amber">
              Details
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
