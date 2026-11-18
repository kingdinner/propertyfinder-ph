import { ErrorState } from "@/components/states/AsyncRegion";

export default function ListingNotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <ErrorState title="Listing not found" body="That sample listing is not in the demo set." actionHref="/search" actionLabel="Back to search" />
    </div>
  );
}
