"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PropertyCard } from "@/components/property/PropertyCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/states/AsyncRegion";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type Tab = "favorites" | "inquiries" | "appointments" | "profile";

type DashboardPayload = {
  summary: { favorites: number; activeInquiries: number; upcomingAppointments: number };
  tab: Tab;
  profile?: {
    fullName: string;
    email: string;
    phoneE164: string | null;
    emailVerifiedAt: string | null;
    roles: string[];
  };
  list: {
    items: unknown[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export default function DashboardClient() {
  const searchParams = useSearchParams();
  const forbidden = searchParams.get("forbidden") === "1";
  const [tab, setTab] = useState<Tab>("favorites");
  const [transaction, setTransaction] = useState<"any" | "sale" | "rent">("any");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [confirmFavoriteId, setConfirmFavoriteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    setError(null);
    const params = new URLSearchParams({ tab, page: String(page), pageSize: "8" });
    if (tab === "favorites" && transaction !== "any") params.set("transaction", transaction);
    const response = await fetch(`/api/v1/dashboard/customer?${params}`);
    if (!response.ok) {
      setStatus("error");
      setError("Unable to load your dashboard.");
      return;
    }
    const body = await response.json();
    setData(body.data);
    setStatus("ready");
  }, [tab, page, transaction]);

  useEffect(() => {
    void load();
  }, [load]);

  async function removeFavorite() {
    if (!confirmFavoriteId) return;
    setBusy(true);
    const response = await fetch(`/api/v1/favorites?listingId=${confirmFavoriteId}`, { method: "DELETE" });
    setBusy(false);
    setConfirmFavoriteId(null);
    if (!response.ok) {
      setError("Could not remove favorite");
      return;
    }
    await load();
  }

  const tabs: Array<{ id: Tab; label: string; count?: number }> = [
    { id: "favorites", label: "Saved properties", count: data?.summary.favorites },
    { id: "appointments", label: "Viewings", count: data?.summary.upcomingAppointments },
    { id: "inquiries", label: "Inquiries", count: data?.summary.activeInquiries },
    { id: "profile", label: "Profile" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
      {forbidden ? (
        <p className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">
          That portal is for owners, agents, or admins. Continue here or ask an admin to grant the right role.
        </p>
      ) : null}
      <div className="rounded-2xl border border-line bg-white p-6">
        <p className="text-xs font-bold text-amber">Customer portal</p>
        <h1 className="text-3xl font-extrabold">Welcome back{data?.profile ? `, ${data.profile.fullName}` : ""}</h1>
        <p className="mt-1 text-sm text-muted">Favorites, inquiries, appointments, and your profile — live from your account.</p>
        <dl className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
          {[
            [String(data?.summary.favorites ?? "—"), "Saved properties"],
            [String(data?.summary.activeInquiries ?? "—"), "Active inquiries"],
            [String(data?.summary.upcomingAppointments ?? "—"), "Upcoming viewings"],
          ].map(([value, label]) => (
            <div key={label} className="rounded-xl bg-surface-low p-4">
              <dt className="text-xs font-bold text-muted">{label}</dt>
              <dd className="text-2xl font-extrabold">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Customer dashboard">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`h-11 rounded-lg px-4 text-sm font-bold ${tab === item.id ? "bg-ink-strong text-white" : "bg-white text-muted"}`}
            onClick={() => {
              setTab(item.id);
              setPage(1);
            }}
          >
            {item.label}
            {item.count != null ? ` (${item.count})` : ""}
          </button>
        ))}
      </div>

      {error ? <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">{error}</p> : null}

      <div className="mt-4" role="tabpanel">
        {status === "loading" ? <LoadingState label="Loading dashboard" /> : null}
        {status === "error" ? <ErrorState body={error ?? "Dashboard unavailable"} actionHref="/dashboard" actionLabel="Retry" /> : null}
        {status === "ready" && data ? (
          <>
            {tab === "favorites" ? (
              <>
                <div className="mb-4 flex flex-wrap gap-2">
                  {(["any", "sale", "rent"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`h-9 rounded-lg px-3 text-sm font-bold ${transaction === value ? "bg-white text-ink" : "bg-surface-mid text-muted"}`}
                      onClick={() => {
                        setTransaction(value);
                        setPage(1);
                      }}
                    >
                      {value === "any" ? "All saved" : value === "sale" ? "For sale" : "For rent"}
                    </button>
                  ))}
                </div>
                {data.list.items.length === 0 ? (
                  <EmptyState title="No saved listings" body="Save published homes from search to build your shortlist." actionHref="/search" actionLabel="Search listings" />
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {(data.list.items as Array<Parameters<typeof PropertyCard>[0]["listing"]>).map((listing) => (
                      <PropertyCard
                        key={listing.id}
                        listing={{ ...listing, isFavorited: true }}
                        layout="row"
                        onToggleFavorite={(id) => setConfirmFavoriteId(id)}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : null}

            {tab === "inquiries" ? (
              data.list.items.length === 0 ? (
                <EmptyState title="No inquiries yet" body="Ask about a published listing to start a conversation." actionHref="/search" actionLabel="Browse listings" />
              ) : (
                <ul className="grid gap-3">
                  {(data.list.items as Array<{ id: string; status: string; message: string; listing: { title: string; publicCode: string; id: string } }>).map((item) => (
                    <li key={item.id} className="rounded-xl border border-line bg-white p-4">
                      <p className="text-xs font-bold text-muted">
                        {item.listing.publicCode} · {item.status.replaceAll("_", " ")}
                      </p>
                      <h2 className="font-extrabold">{item.listing.title}</h2>
                      <p className="mt-1 text-sm text-muted">{item.message}</p>
                      <Link href={`/listings/${item.listing.id}`} className="mt-2 inline-block text-sm font-bold text-amber">
                        Open listing
                      </Link>
                    </li>
                  ))}
                </ul>
              )
            ) : null}

            {tab === "appointments" ? (
              data.list.items.length === 0 ? (
                <EmptyState title="No viewings scheduled" body="Request a viewing from an inquiry thread." actionHref="/search" actionLabel="Browse listings" />
              ) : (
                <ul className="grid gap-3">
                  {(data.list.items as Array<{ id: string; status: string; startsAtManila: string; endsAtManila: string; listing: { title: string; publicCode: string } }>).map((item) => (
                    <li key={item.id} className="rounded-xl border border-line bg-white p-4">
                      <p className="text-xs font-bold text-amber">{item.startsAtManila} Asia/Manila</p>
                      <p className="font-extrabold">{item.listing.title}</p>
                      <p className="text-sm capitalize text-muted">
                        {item.status.replaceAll("_", " ")} · until {item.endsAtManila}
                      </p>
                    </li>
                  ))}
                </ul>
              )
            ) : null}

            {tab === "profile" && data.profile ? (
              <section className="rounded-2xl border border-line bg-white p-5">
                <h2 className="text-lg font-extrabold">Profile</h2>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  {[
                    ["Name", data.profile.fullName],
                    ["Email", data.profile.email],
                    ["Phone", data.profile.phoneE164 ?? "—"],
                    ["Email verified", data.profile.emailVerifiedAt ? "Yes" : "No"],
                    ["Roles", data.profile.roles.join(", ")],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-surface-low p-3">
                      <dt className="text-xs font-bold text-muted">{label}</dt>
                      <dd className="font-semibold">{value}</dd>
                    </div>
                  ))}
                </dl>
                <Link href="/profile" className="mt-4 inline-flex">
                  <Button>Edit profile</Button>
                </Link>
              </section>
            ) : null}

            {tab !== "profile" && data.list.totalPages > 1 ? (
              <div className="mt-6 flex items-center justify-between gap-3">
                <p className="text-sm text-muted">
                  Page {data.list.page} of {data.list.totalPages}
                </p>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={page >= data.list.totalPages}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      <ConfirmDialog
        open={Boolean(confirmFavoriteId)}
        title="Remove saved listing?"
        body="This listing will leave your saved properties list. You can save it again later."
        confirmLabel="Remove"
        danger
        busy={busy}
        onCancel={() => setConfirmFavoriteId(null)}
        onConfirm={() => void removeFavorite()}
      />
    </div>
  );
}
