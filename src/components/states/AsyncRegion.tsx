import Link from "next/link";

export function LoadingState({ label = "Loading listings" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="grid gap-4">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1].map((item) => (
          <div key={item} className="overflow-hidden rounded-xl border border-line bg-white">
            <div className="h-36 animate-pulse bg-surface-high" />
            <div className="grid gap-2 p-4">
              <div className="h-4 w-2/3 animate-pulse rounded bg-surface-mid" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-surface-mid" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  body,
  actionHref,
  actionLabel,
}: {
  title: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-white px-6 py-10 text-center">
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{body}</p>
      {actionHref && actionLabel ? (
        <Link href={actionHref} className="mt-4 inline-flex h-10 items-center rounded-lg bg-amber px-4 text-sm font-bold text-white">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  body,
  actionHref = "/",
  actionLabel = "Back to home",
}: {
  title?: string;
  body: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div role="alert" className="rounded-xl border border-danger-soft bg-white px-6 py-10 text-center">
      <h2 className="text-lg font-bold text-danger">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{body}</p>
      <Link href={actionHref} className="mt-4 inline-flex h-10 items-center rounded-lg bg-ink-strong px-4 text-sm font-bold text-white">
        {actionLabel}
      </Link>
    </div>
  );
}

export function AsyncRegion({
  status,
  emptyTitle,
  emptyBody,
  errorBody,
  children,
}: {
  status: "loading" | "empty" | "error" | "ready";
  emptyTitle: string;
  emptyBody: string;
  errorBody: string;
  children: React.ReactNode;
}) {
  if (status === "loading") return <LoadingState />;
  if (status === "empty") return <EmptyState title={emptyTitle} body={emptyBody} actionHref="/search" actionLabel="Clear and browse" />;
  if (status === "error") return <ErrorState body={errorBody} />;
  return <>{children}</>;
}
