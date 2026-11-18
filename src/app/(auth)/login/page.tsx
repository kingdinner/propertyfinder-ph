import { Suspense } from "react";
import LoginPage from "./LoginClient";

export const metadata = { title: "Sign in" };

export default function Page() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md text-sm text-muted">Loading…</div>}>
      <LoginPage />
    </Suspense>
  );
}
