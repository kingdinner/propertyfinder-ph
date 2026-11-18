import { LoadingState } from "@/components/states/AsyncRegion";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
      <LoadingState label="Loading search" />
    </div>
  );
}
