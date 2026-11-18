import Link from "next/link";
import { PropertyCard } from "@/components/property/PropertyCard";
import { EmptyState } from "@/components/states/AsyncRegion";
import { searchPublishedListings } from "@/lib/search/service";
import { parseSearchParams } from "@/lib/validation/search";

const places = [
  { title: "Metro Manila condominiums", detail: "BGC, Makati, and Ortigas", href: "/search?city=Taguig" },
  { title: "South Luzon estates", detail: "Lipa, Nuvali, and Tagaytay", href: "/search?city=Lipa%20City" },
  { title: "Provincial and coastal", detail: "Calapan, Palawan, and Cebu", href: "/search?city=Calapan" },
];

export default async function HomePage() {
  const featured = await searchPublishedListings(
    parseSearchParams({ sort: "newest", page: "1", pageSize: "4" }),
  );

  return (
    <div>
      <section className="bg-ink-strong text-white">
        <div className="mx-auto max-w-7xl px-4 py-14 lg:px-6 lg:py-20">
          <p className="text-xs font-bold tracking-[0.16em] text-amber-bright">PROPERTY MARKETPLACE</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
            Find your sanctuary in the Philippines
          </h1>
          <p className="mt-4 max-w-2xl text-base text-amber-soft">
            Search homes for sale or rent, open a listing, and contact the owner or broker.
          </p>
          <form action="/search" className="mt-8 grid gap-3 rounded-2xl bg-white p-4 text-ink md:grid-cols-5">
            <label className="grid gap-1 text-xs font-bold">
              Buy or rent
              <select name="transaction" className="h-11 rounded-lg bg-surface-low px-2 text-sm font-semibold" defaultValue="sale">
                <option value="sale">Buy</option>
                <option value="rent">Rent</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-bold md:col-span-2">
              Location
              <select name="city" className="h-11 rounded-lg bg-surface-low px-2 text-sm font-semibold" defaultValue="">
                <option value="">All Philippine locations</option>
                <option value="Makati">Makati</option>
                <option value="Taguig">BGC, Taguig</option>
                <option value="Lipa City">Lipa City</option>
                <option value="Calapan">Calapan</option>
                <option value="Quezon City">Quezon City</option>
                <option value="Cebu City">Cebu City</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-bold">
              Category
              <select name="category" className="h-11 rounded-lg bg-surface-low px-2 text-sm font-semibold" defaultValue="">
                <option value="">All types</option>
                <option value="house_lot">House & lot</option>
                <option value="condo">Condominium</option>
                <option value="townhouse">Townhouse</option>
                <option value="lot">Lot</option>
                <option value="commercial">Commercial</option>
              </select>
            </label>
            <button type="submit" className="h-11 self-end rounded-lg bg-amber text-sm font-bold text-white">
              Search
            </button>
          </form>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 lg:px-6">
        <div className="mb-4 flex items-end justify-between gap-4">
          <h2 className="text-2xl font-extrabold">Explore locations</h2>
          <Link href="/search" className="rounded-full bg-amber-soft px-3 py-1 text-xs font-bold text-amber">
            View all published
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {places.map((place) => (
            <Link key={place.title} href={place.href} className="rounded-2xl bg-ink-strong p-6 text-white">
              <p className="text-lg font-extrabold">{place.title}</p>
              <p className="mt-2 text-sm text-amber-soft">{place.detail}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-4 lg:px-6">
        <div className="mb-4 flex items-end justify-between gap-4">
          <h2 className="text-2xl font-extrabold">Featured listings</h2>
          <Link href="/search" className="text-sm font-bold text-amber">
            Browse search
          </Link>
        </div>
        {featured.items.length === 0 ? (
          <EmptyState
            title="No published listings yet"
            body="Owners and brokers can submit a listing for review. After approval it appears here."
            actionHref="/list"
            actionLabel="List a property"
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {featured.items.map((listing) => (
              <PropertyCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-10 md:grid-cols-3 lg:px-6">
        {[
          ["One search", "Buy and rent share the same results, filters, and map layout."],
          ["Inquiry first", "Guests can browse. Signed-in customers save listings and request a viewing."],
          ["Review before publish", "A listing stays private until an admin marks it published."],
        ].map(([title, body]) => (
          <article key={title} className="rounded-xl border border-line bg-white p-5">
            <h3 className="font-extrabold">{title}</h3>
            <p className="mt-2 text-sm text-muted">{body}</p>
          </article>
        ))}
      </section>

      <section className="mx-auto max-w-7xl px-4 lg:px-6">
        <div className="flex flex-col items-start justify-between gap-4 rounded-2xl bg-ink-strong px-6 py-8 text-white md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-extrabold">List a property</h2>
            <p className="mt-2 max-w-xl text-sm text-amber-soft">Owners and brokers complete the listing form and submit it for review.</p>
          </div>
          <Link href="/list" className="inline-flex h-11 items-center rounded-lg bg-amber-bright px-4 text-sm font-bold text-ink-strong">
            Start a listing
          </Link>
        </div>
      </section>
    </div>
  );
}
