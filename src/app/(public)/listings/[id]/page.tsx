import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InquiryForm } from "@/components/inquiries/InquiryForm";
import { ReportListingButton } from "@/components/listings/ReportListingButton";
import { PropertyCard } from "@/components/property/PropertyCard";
import { getSessionFromCookies } from "@/lib/auth/service";
import { categoryLabel } from "@/lib/search/url";
import { getPublishedListing } from "@/lib/search/service";
import { formatArea, formatPeso } from "@/lib/format";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const listing = await getPublishedListing(id);
  return { title: listing?.title ?? "Listing" };
}

export default async function ListingPage({ params }: Params) {
  const { id } = await params;
  const session = await getSessionFromCookies().catch(() => null);
  const listing = await getPublishedListing(id, { viewerUserId: session?.user.id });
  if (!listing) notFound();

  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 lg:grid-cols-[1fr_320px] lg:px-6">
      <article>
        <p className="text-xs font-bold text-muted">
          <Link href="/search">Search</Link> / {categoryLabel[listing.category]}
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{listing.title}</h1>
        <p className="mt-1 text-sm text-muted">{listing.location}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {listing.media[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={listing.media[0].url}
              alt=""
              className="col-span-2 min-h-56 w-full rounded-2xl object-cover sm:col-span-2 sm:row-span-2"
            />
          ) : (
            <div className="col-span-2 min-h-56 rounded-2xl bg-[linear-gradient(145deg,#131b2e,#fe932c)] sm:col-span-2 sm:row-span-2" />
          )}
          <div className="min-h-28 rounded-2xl bg-surface-high" />
          <div className="min-h-28 rounded-2xl bg-surface-mid" />
        </div>
        <p className="mt-2 text-xs font-semibold text-muted">{listing.publicCode} · published listing</p>
        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Price", formatPeso(listing.priceCentavos, listing.transaction)],
            ["Beds", String(listing.bedrooms)],
            ["Baths", String(listing.bathrooms)],
            ["Floor area", formatArea(listing.floorAreaSqm)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-white p-3">
              <dt className="text-xs font-bold text-muted">{label}</dt>
              <dd className="font-extrabold">{value}</dd>
            </div>
          ))}
        </dl>
        <section className="mt-6 rounded-2xl border border-line bg-white p-5">
          <h2 className="text-lg font-extrabold">About this listing</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{listing.description}</p>
          <p className="mt-3 text-xs text-muted">
            {listing.badge}. Declared title status is a seller statement, not an LRA certification.
          </p>
        </section>
        <section className="mt-4 min-h-48 rounded-2xl border border-line bg-surface-high p-5" aria-label="Map preview">
          <h2 className="text-lg font-extrabold">Location</h2>
          <p className="mt-2 text-sm text-muted">
            {listing.location}
            {listing.lat != null && listing.lng != null
              ? ` · ${listing.lat.toFixed(5)}, ${listing.lng.toFixed(5)}`
              : " · coordinates not provided"}
          </p>
        </section>
        {listing.related.length > 0 ? (
          <section className="mt-8">
            <h2 className="mb-3 text-lg font-extrabold">Nearby published listings</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {listing.related.map((item) => (
                <PropertyCard key={item.id} listing={item} />
              ))}
            </div>
          </section>
        ) : null}
      </article>
      <aside className="h-fit rounded-2xl border border-line bg-white p-5 lg:sticky lg:top-24">
        <p className="text-2xl font-extrabold">{formatPeso(listing.priceCentavos, listing.transaction)}</p>
        <p className="mt-3 text-sm font-bold">{listing.broker}</p>
        <p className="text-xs text-muted">{listing.prcLicense}</p>
        <InquiryForm listingId={listing.id} />
        <p className="mt-3 text-xs text-muted">Messages route to the assigned broker, or the owner when no broker is set.</p>
        <ReportListingButton listingId={listing.id} />
      </aside>
    </div>
  );
}
