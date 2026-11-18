"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { PropertyCard } from "@/components/property/PropertyCard";
import { AsyncRegion } from "@/components/states/AsyncRegion";
import { Button } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Fields";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import type { SearchHit } from "@/lib/search/service";
import { activeFilterChips, availabilityLabel, buildSearchQueryString, categoryLabel, furnishingLabel } from "@/lib/search/url";
import type { SearchQuery } from "@/lib/validation/search";

type SearchResponse = {
  items: SearchHit[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  filters: SearchQuery;
};

type ViewMode = "grid" | "list" | "map";

export function SearchScreen({
  initial,
  cities,
}: {
  initial: SearchResponse;
  cities: Array<{ city: string; province: string }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [data, setData] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>((initial.filters.view as ViewMode) || "grid");

  const filters = data.filters;
  const chips = useMemo(() => activeFilterChips(filters), [filters]);
  const showLotFilters = !filters.category || filters.category === "lot" || filters.category === "house_lot" || filters.category === "townhouse";
  const showHomeFilters = filters.category !== "lot" && filters.category !== "commercial";

  const push = useCallback(
    (patch: Record<string, string | number | null | undefined>) => {
      const query = buildSearchQueryString(searchParams, { ...patch, view });
      startTransition(() => {
        router.replace(query ? `/search?${query}` : "/search");
      });
    },
    [router, searchParams, view],
  );

  useEffect(() => {
    const query = searchParams.toString();
    const controller = new AbortController();
    startTransition(() => {
      void fetch(`/api/v1/search?${query}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error("Search failed");
          return response.json();
        })
        .then((body) => {
          setData(body.data ?? body);
          setError(null);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setError("Could not refresh search results");
        });
    });
    return () => controller.abort();
  }, [searchParams]);

  useEffect(() => {
    const next = (searchParams.get("view") as ViewMode) || "grid";
    if (next === "grid" || next === "list" || next === "map") setView(next);
  }, [searchParams]);

  async function toggleFavorite(listingId: string, next: boolean) {
    setError(null);
    const response = next
      ? await fetch("/api/v1/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listingId }),
        })
      : await fetch(`/api/v1/favorites?listingId=${listingId}`, { method: "DELETE" });
    if (response.status === 401) {
      window.location.assign(`/login?next=${encodeURIComponent(`/search?${searchParams.toString()}`)}`);
      return;
    }
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error?.message ?? "Could not update favorites");
      return;
    }
    setData((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === listingId ? { ...item, isFavorited: next } : item,
      ),
    }));
  }

  const pins = data.items.filter((item) => item.lat != null && item.lng != null);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
      <p className="text-xs font-bold text-muted">
        Home / {filters.transaction === "rent" ? "For rent" : filters.transaction === "sale" ? "For sale" : "Search"}
      </p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Properties {filters.transaction === "rent" ? "for rent" : filters.transaction === "sale" ? "for sale" : "for sale and rent"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {data.total} published listing{data.total === 1 ? "" : "s"} match these filters.
          </p>
        </div>
        <div className="flex gap-2">
          {(["grid", "list", "map"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`h-9 rounded-lg px-3 text-sm font-bold capitalize ${view === mode ? "bg-ink-strong text-white" : "bg-surface-mid"}`}
              onClick={() => {
                setView(mode);
                push({ view: mode, page: 1 });
              }}
            >
              {mode === "list" ? "List" : mode === "map" ? "Map" : "Grid"}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">{error}</p> : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)]">
        <aside className="h-fit rounded-2xl border border-line bg-white p-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-extrabold">Filters</h2>
            <button type="button" className="text-xs font-bold text-amber" onClick={() => router.replace("/search")}>
              Clear all
            </button>
          </div>
          <div className="mt-4 grid gap-4">
            <SegmentedControl
              label="Buy or rent"
              value={filters.transaction ?? "any"}
              onChange={(value) =>
                push({
                  transaction: value === "any" ? null : value,
                  // Sale and rent use different price scales — clear sticky price filters.
                  minPrice: null,
                  maxPrice: null,
                  page: 1,
                })
              }
              options={[
                { value: "any", label: "Any" },
                { value: "sale", label: "Buy" },
                { value: "rent", label: "Rent" },
              ]}
            />
            <TextField
              label="Keyword"
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder="Title, barangay, subdivision"
              onBlur={(event) => push({ q: event.target.value || null, page: 1 })}
            />
            <SelectField
              label="Category"
              value={filters.category ?? "any"}
              onChange={(event) => {
                const value = event.target.value;
                push({
                  category: value === "any" ? null : value,
                  minLotArea: value === "condo" ? null : filters.minLotArea,
                  maxLotArea: value === "condo" ? null : filters.maxLotArea,
                  page: 1,
                });
              }}
            >
              <option value="any">All types</option>
              {Object.entries(categoryLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
            <TextField
              label="Province"
              name="province"
              defaultValue={filters.province ?? ""}
              onBlur={(event) => push({ province: event.target.value || null, page: 1 })}
            />
            <SelectField
              label="City / municipality"
              value={filters.city ?? "any"}
              onChange={(event) => push({ city: event.target.value === "any" ? null : event.target.value, page: 1 })}
            >
              <option value="any">All cities</option>
              {cities.map((item) => (
                <option key={`${item.province}-${item.city}`} value={item.city}>
                  {item.city}, {item.province}
                </option>
              ))}
            </SelectField>
            <TextField
              label="Barangay"
              name="barangay"
              defaultValue={filters.barangay ?? ""}
              onBlur={(event) => push({ barangay: event.target.value || null, page: 1 })}
            />
            <div className="grid grid-cols-2 gap-3">
              <TextField
                key={`minPrice-${filters.transaction ?? "any"}-${filters.minPrice ?? ""}`}
                label={filters.transaction === "rent" ? "Min rent (PHP)" : "Min price (PHP)"}
                name="minPrice"
                inputMode="numeric"
                defaultValue={filters.minPrice ?? ""}
                onBlur={(event) => push({ minPrice: event.target.value || null, page: 1 })}
              />
              <TextField
                key={`maxPrice-${filters.transaction ?? "any"}-${filters.maxPrice ?? ""}`}
                label={filters.transaction === "rent" ? "Max rent (PHP)" : "Max price (PHP)"}
                name="maxPrice"
                inputMode="numeric"
                defaultValue={filters.maxPrice ?? ""}
                onBlur={(event) => push({ maxPrice: event.target.value || null, page: 1 })}
              />
            </div>
            {showHomeFilters ? (
              <>
                <SegmentedControl
                  label="Bedrooms"
                  value={String(filters.bedrooms ?? 0)}
                  onChange={(value) => push({ bedrooms: Number(value) || null, page: 1 })}
                  options={[
                    { value: "0", label: "Any" },
                    { value: "1", label: "1+" },
                    { value: "2", label: "2+" },
                    { value: "3", label: "3+" },
                    { value: "4", label: "4+" },
                  ]}
                />
                <SegmentedControl
                  label="Bathrooms"
                  value={String(filters.bathrooms ?? 0)}
                  onChange={(value) => push({ bathrooms: Number(value) || null, page: 1 })}
                  options={[
                    { value: "0", label: "Any" },
                    { value: "1", label: "1+" },
                    { value: "2", label: "2+" },
                    { value: "3", label: "3+" },
                  ]}
                />
              </>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Min floor (sqm)"
                name="minFloorArea"
                inputMode="decimal"
                defaultValue={filters.minFloorArea ?? ""}
                onBlur={(event) => push({ minFloorArea: event.target.value || null, page: 1 })}
              />
              <TextField
                label="Max floor (sqm)"
                name="maxFloorArea"
                inputMode="decimal"
                defaultValue={filters.maxFloorArea ?? ""}
                onBlur={(event) => push({ maxFloorArea: event.target.value || null, page: 1 })}
              />
            </div>
            {showLotFilters ? (
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  label="Min lot (sqm)"
                  name="minLotArea"
                  inputMode="decimal"
                  defaultValue={filters.minLotArea ?? ""}
                  onBlur={(event) => push({ minLotArea: event.target.value || null, page: 1 })}
                />
                <TextField
                  label="Max lot (sqm)"
                  name="maxLotArea"
                  inputMode="decimal"
                  defaultValue={filters.maxLotArea ?? ""}
                  onBlur={(event) => push({ maxLotArea: event.target.value || null, page: 1 })}
                />
              </div>
            ) : null}
            <SelectField
              label="Parking"
              value={String(filters.parking ?? "any")}
              onChange={(event) =>
                push({ parking: event.target.value === "any" ? null : Number(event.target.value), page: 1 })
              }
            >
              <option value="any">Any</option>
              <option value="1">1+</option>
              <option value="2">2+</option>
              <option value="3">3+</option>
            </SelectField>
            <SelectField
              label="Furnishing"
              value={filters.furnishing ?? "any"}
              onChange={(event) =>
                push({ furnishing: event.target.value === "any" ? null : event.target.value, page: 1 })
              }
            >
              <option value="any">Any</option>
              {Object.entries(furnishingLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Availability"
              value={filters.availability ?? "any"}
              onChange={(event) =>
                push({ availability: event.target.value === "any" ? null : event.target.value, page: 1 })
              }
            >
              <option value="any">Any</option>
              {Object.entries(availabilityLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Sort by"
              value={filters.sort}
              onChange={(event) => push({ sort: event.target.value, page: 1 })}
            >
              <option value="newest">Newest</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
              <option value="beds_desc">Most bedrooms</option>
            </SelectField>
          </div>
        </aside>

        <div className="grid min-w-0 gap-4">
          {chips.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-surface-mid px-3 py-1.5 text-xs font-bold text-ink hover:bg-surface-high"
                  aria-label={`Remove filter ${chip.label}`}
                  onClick={() => push({ ...chip.clear, page: 1 })}
                >
                  <span>{chip.label}</span>
                  <span aria-hidden="true" className="text-muted">
                    ×
                  </span>
                </button>
              ))}
              <button
                type="button"
                className="text-xs font-bold text-amber"
                onClick={() => {
                  const keepView = view && view !== "grid" ? `?view=${view}` : "";
                  router.replace(`/search${keepView}`);
                }}
              >
                Clear filters
              </button>
            </div>
          ) : null}

          {view === "map" ? (
            <div className="grid min-h-[min(70vh,640px)] gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,320px)]">
              <div
                className="relative min-h-[360px] overflow-hidden rounded-2xl border border-line bg-surface-high xl:min-h-full"
                aria-label="Map view"
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,#dce9ff,transparent_40%),linear-gradient(#c6c6cd_1px,transparent_1px),linear-gradient(90deg,#c6c6cd_1px,transparent_1px)] bg-[size:auto,24px_24px,24px_24px]" />
                <p className="absolute left-4 top-4 rounded-lg bg-white px-3 py-1 text-xs font-bold shadow-sm">
                  Map view · {pins.length} pinned result{pins.length === 1 ? "" : "s"}
                </p>
                {pins.map((pin, index) => {
                  const left = 12 + ((index * 17) % 70);
                  const top = 18 + ((index * 23) % 55);
                  return (
                    <Link
                      key={pin.id}
                      href={`/listings/${pin.id}`}
                      className="absolute z-10 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-amber text-[11px] font-extrabold text-white shadow"
                      style={{ left: `${left}%`, top: `${top}%` }}
                      title={pin.title}
                    >
                      {index + 1}
                    </Link>
                  );
                })}
              </div>
              <AsyncRegion
                status={pending ? "loading" : data.items.length === 0 ? "empty" : error ? "error" : "ready"}
                emptyTitle="No published listings match"
                emptyBody="Try clearing a filter or broadening price, beds, or location. Only published available listings appear here."
                errorBody="Search results could not be shown."
              >
                <ul className="grid max-h-[min(70vh,640px)] gap-3 overflow-y-auto pr-1">
                  {data.items.map((listing, index) => (
                    <li key={listing.id} className="min-w-0">
                      <div className="relative">
                        <span className="absolute left-3 top-3 z-10 grid h-6 w-6 place-items-center rounded-full bg-ink-strong text-[10px] font-bold text-white">
                          {index + 1}
                        </span>
                        <PropertyCard
                          listing={listing}
                          layout="row"
                          onToggleFavorite={(id, next) => void toggleFavorite(id, next)}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </AsyncRegion>
            </div>
          ) : (
            <AsyncRegion
              status={pending ? "loading" : data.items.length === 0 ? "empty" : error ? "error" : "ready"}
              emptyTitle="No published listings match"
              emptyBody="Try clearing a filter or broadening price, beds, or location. Only published available listings appear here."
              errorBody="Search results could not be shown."
            >
              <div
                className={
                  view === "grid"
                    ? "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3"
                    : "grid grid-cols-1 gap-3"
                }
              >
                {data.items.map((listing) => (
                  <PropertyCard
                    key={listing.id}
                    listing={listing}
                    layout={view === "list" ? "row" : "grid"}
                    onToggleFavorite={(id, next) => void toggleFavorite(id, next)}
                  />
                ))}
              </div>
            </AsyncRegion>
          )}

          {data.totalPages > 1 ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">
                Page {data.page} of {data.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={data.page <= 1 || pending}
                  onClick={() => push({ page: data.page - 1 })}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={data.page >= data.totalPages || pending}
                  onClick={() => push({ page: data.page + 1 })}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
