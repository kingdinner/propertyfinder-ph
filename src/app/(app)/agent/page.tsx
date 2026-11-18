"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/states/AsyncRegion";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SelectField } from "@/components/ui/Fields";
import { centavosToPesos } from "@/lib/listings/form";

type Tab = "listings" | "inquiries" | "appointments";

type AgentPayload = {
  summary: {
    listingsTotal: number;
    listingStatusCounts: Record<string, number>;
    openInquiries: number;
    openAppointments: number;
  };
  tab: Tab;
  list: {
    items: Array<Record<string, unknown>>;
    page: number;
    totalPages: number;
    total: number;
  };
};

export default function AgentPage() {
  const [tab, setTab] = useState<Tab>("listings");
  const [listingStatus, setListingStatus] = useState("any");
  const [inquiryStatus, setInquiryStatus] = useState("any");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AgentPayload | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [confirmDecision, setConfirmDecision] = useState<{ id: string; action: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    setError(null);
    const params = new URLSearchParams({ tab, page: String(page), pageSize: "10" });
    if (tab === "listings" && listingStatus !== "any") params.set("listingStatus", listingStatus);
    if (tab === "inquiries" && inquiryStatus !== "any") params.set("inquiryStatus", inquiryStatus);
    const response = await fetch(`/api/v1/dashboard/agent?${params}`, { credentials: "same-origin" });
    if (!response.ok) {
      setStatus("error");
      setError("Unable to load owner/agent dashboard.");
      return;
    }
    setData((await response.json()).data);
    setStatus("ready");
  }, [tab, page, listingStatus, inquiryStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decideAppointment() {
    if (!confirmDecision) return;
    setBusy(true);
    const response = await fetch(`/api/v1/appointments/${confirmDecision.id}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: confirmDecision.action,
        note: confirmDecision.action === "decline" ? "Host unavailable" : undefined,
      }),
    });
    setBusy(false);
    setConfirmDecision(null);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error?.message ?? "Appointment update failed");
      return;
    }
    await load();
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
      <div className="rounded-2xl border border-line bg-white p-6">
        <p className="text-xs font-bold text-amber">Owner / agent portal</p>
        <h1 className="text-3xl font-extrabold">Listings and leads</h1>
        <p className="mt-1 text-sm text-muted">Owned or assigned inventory, inquiry pipeline, and viewing requests.</p>
        <div className="mt-4">
          <Link href="/list">
            <Button variant="amber">New listing</Button>
          </Link>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            [String(data?.summary.listingsTotal ?? "—"), "Own listings"],
            [String(data?.summary.listingStatusCounts?.published ?? 0), "Published"],
            [String(data?.summary.openInquiries ?? "—"), "Open inquiries"],
            [String(data?.summary.openAppointments ?? "—"), "Open viewings"],
          ].map(([value, label]) => (
            <div key={label} className="rounded-xl bg-surface-low p-4">
              <dt className="text-xs font-bold text-muted">{label}</dt>
              <dd className="text-2xl font-extrabold">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-6 flex flex-wrap gap-2" role="tablist">
        {(
          [
            ["listings", "Listings"],
            ["inquiries", "Inquiries"],
            ["appointments", "Appointments"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`h-11 rounded-lg px-4 text-sm font-bold ${tab === id ? "bg-ink-strong text-white" : "bg-white text-muted"}`}
            onClick={() => {
              setTab(id);
              setPage(1);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">{error}</p> : null}

      <div className="mt-4">
        {status === "loading" || (data && data.tab !== tab) ? (
          <LoadingState label="Loading agent dashboard" />
        ) : null}
        {status === "error" ? <ErrorState body={error ?? "Dashboard unavailable"} /> : null}
        {status === "ready" && data && data.tab === tab ? (
          <>
            {tab === "listings" ? (
              <>
                <div className="mb-4 max-w-xs">
                  <SelectField
                    label="Listing status"
                    value={listingStatus}
                    onChange={(event) => {
                      setListingStatus(event.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="any">All statuses</option>
                    {["draft", "pending_review", "needs_revision", "rejected", "published", "archived"].map((value) => (
                      <option key={value} value={value}>
                        {value.replaceAll("_", " ")} ({data.summary.listingStatusCounts[value] ?? 0})
                      </option>
                    ))}
                  </SelectField>
                </div>
                {data.list.items.length === 0 ? (
                  <EmptyState title="No listings yet" body="Create a draft listing to start marketing a property." actionHref="/list" actionLabel="List property" />
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-line bg-white">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="text-xs text-muted">
                        <tr>
                          <th className="px-4 py-3 font-bold">Code</th>
                          <th className="px-4 py-3 font-bold">Title</th>
                          <th className="px-4 py-3 font-bold">Status</th>
                          <th className="px-4 py-3 font-bold">Price</th>
                          <th className="px-4 py-3 font-bold">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.list.items.map((item) => (
                          <tr key={String(item.id)} className="border-t border-line">
                            <td className="px-4 py-3 font-semibold">{String(item.publicCode)}</td>
                            <td className="px-4 py-3">{String(item.title)}</td>
                            <td className="px-4 py-3 capitalize">{String(item.status).replaceAll("_", " ")}</td>
                            <td className="px-4 py-3">
                              ₱{Number(centavosToPesos(Number(item.pricePhpCentavos ?? 0))).toLocaleString("en-PH")}
                            </td>
                            <td className="px-4 py-3">
                              <Link href={`/list/${String(item.id)}`} className="font-bold text-amber">
                                Open
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : null}

            {tab === "inquiries" ? (
              <>
                <div className="mb-4 max-w-xs">
                  <SelectField
                    label="Inquiry status"
                    value={inquiryStatus}
                    onChange={(event) => {
                      setInquiryStatus(event.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="any">All statuses</option>
                    {["new", "contacted", "qualified", "viewing_scheduled", "converted", "closed", "lost"].map((value) => (
                      <option key={value} value={value}>
                        {value.replaceAll("_", " ")}
                      </option>
                    ))}
                  </SelectField>
                </div>
                {data.list.items.length === 0 ? (
                  <EmptyState title="No assigned inquiries" body="Inquiries on your published listings appear here." actionHref="/list" actionLabel="Manage listings" />
                ) : (
                  <ul className="grid gap-3 lg:grid-cols-2">
                    {data.list.items.map((item) => {
                      const listing = (item.listing as { title?: string; publicCode?: string } | undefined) ?? {};
                      return (
                        <li key={String(item.id)} className="rounded-2xl border border-line bg-white p-4">
                          <p className="text-xs font-bold text-muted">
                            {listing.publicCode ?? "Listing"} · {String(item.contactName ?? "Customer")}
                          </p>
                          <h3 className="font-extrabold">{listing.title ?? "Untitled listing"}</h3>
                          <p className="mt-1 text-sm capitalize text-muted">{String(item.status ?? "").replaceAll("_", " ")}</p>
                          <p className="mt-2 text-sm text-muted">{String(item.message ?? "")}</p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            ) : null}

            {tab === "appointments" ? (
              data.list.items.length === 0 ? (
                <EmptyState title="No viewing requests" body="Customer viewing requests for your listings show up here." />
              ) : (
                <ul className="grid gap-3">
                  {data.list.items.map((item) => {
                    const listing = (item.listing as { title?: string; publicCode?: string } | undefined) ?? {};
                    return (
                      <li key={String(item.id)} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white p-4">
                        <div>
                          <p className="text-xs font-bold text-amber">{String(item.startsAtManila ?? "—")} Asia/Manila</p>
                          <p className="font-extrabold">{listing.title ?? "Untitled listing"}</p>
                          <p className="text-sm capitalize text-muted">
                            {String(item.status ?? "").replaceAll("_", " ")} · {String(item.contactName ?? "Customer")}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {item.status === "requested" || item.status === "reschedule_requested" ? (
                            <>
                              <Button type="button" onClick={() => setConfirmDecision({ id: String(item.id), action: "confirm" })}>
                                Confirm
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setConfirmDecision({ id: String(item.id), action: "decline" })}
                              >
                                Decline
                              </Button>
                            </>
                          ) : null}
                          {item.status === "confirmed" ? (
                            <Button type="button" variant="amber" onClick={() => setConfirmDecision({ id: String(item.id), action: "complete" })}>
                              Complete
                            </Button>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )
            ) : null}

            {data.list.totalPages > 1 ? (
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
        open={Boolean(confirmDecision)}
        title={`${confirmDecision?.action === "confirm" ? "Confirm" : confirmDecision?.action === "decline" ? "Decline" : "Complete"} viewing?`}
        body="This updates the appointment status and notifies the customer."
        confirmLabel="Continue"
        busy={busy}
        onCancel={() => setConfirmDecision(null)}
        onConfirm={() => void decideAppointment()}
      />
    </div>
  );
}
