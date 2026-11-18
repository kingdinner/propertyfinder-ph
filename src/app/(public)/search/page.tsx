import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchScreen } from "@/components/search/SearchScreen";
import { LoadingState } from "@/components/states/AsyncRegion";
import { getSessionFromCookies } from "@/lib/auth/service";
import { listDistinctPublishedCities, searchPublishedListings } from "@/lib/search/service";
import { parseSearchParams } from "@/lib/validation/search";

export const metadata: Metadata = { title: "Search" };

async function SearchResults({
  raw,
}: {
  raw: Record<string, string | string[] | undefined>;
}) {
  let query;
  try {
    query = parseSearchParams(raw);
  } catch {
    query = parseSearchParams({ page: "1" });
  }
  const session = await getSessionFromCookies().catch(() => null);
  const [result, cities] = await Promise.all([
    searchPublishedListings(query, { viewerUserId: session?.user.id }),
    listDistinctPublishedCities(),
  ]);
  return <SearchScreen initial={result} cities={cities} />;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const cacheKey = Object.entries(raw)
    .flatMap(([key, value]) => {
      if (value == null) return [];
      return Array.isArray(value) ? value.map((entry) => `${key}=${entry}`) : [`${key}=${value}`];
    })
    .sort()
    .join("&");
  return (
    <Suspense
      key={cacheKey || "search"}
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-16">
          <LoadingState label="Loading search" />
        </div>
      }
    >
      <SearchResults raw={raw} />
    </Suspense>
  );
}
