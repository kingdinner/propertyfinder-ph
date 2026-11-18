import { ErrorState } from "@/components/states/AsyncRegion";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <ErrorState title="Page not found" body="That route is not part of the PropertyFinder PH foundation." />
    </div>
  );
}
