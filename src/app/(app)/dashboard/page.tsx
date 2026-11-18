import { Suspense } from "react";
import { LoadingState } from "@/components/states/AsyncRegion";
import DashboardClient from "./DashboardClient";

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
          <LoadingState label="Loading dashboard" />
        </div>
      }
    >
      <DashboardClient />
    </Suspense>
  );
}
