"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/states/AsyncRegion";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Fields";
import { centavosToPesos } from "@/lib/listings/form";

type Tab = "moderation" | "listings" | "users" | "agents" | "reports" | "analytics";

type AdminPayload = {
  summary: {
    pendingApprovals: number;
    publishedListings: number;
    rejectedListings: number;
    openReports: number;
    usersTotal: number;
    agentsTotal: number;
  };
  tab: Tab;
  analytics?: {
    inquiries: Record<string, number>;
    listings: Record<string, number>;
    appointments: Record<string, number>;
  };
  list: {
    items: Array<Record<string, unknown>>;
    page: number;
    totalPages: number;
    total: number;
  };
};

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("moderation");
  const [listingStatus, setListingStatus] = useState("published");
  const [reportStatus, setReportStatus] = useState("open");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminPayload | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    kind: "moderate" | "suspend" | "license" | "report";
    id: string;
    payload: Record<string, unknown>;
    title: string;
    body: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    setError(null);
    const params = new URLSearchParams({ tab, page: String(page), pageSize: "10" });
    if (tab === "listings") params.set("listingStatus", listingStatus);
    if (tab === "reports") params.set("reportStatus", reportStatus);
    if (tab === "users" && q.trim()) params.set("q", q.trim());
    const response = await fetch(`/api/v1/dashboard/admin?${params}`, { credentials: "same-origin" });
    if (!response.ok) {
      setStatus("error");
      setError("Unable to load admin dashboard.");
      return;
    }
    const body = await response.json();
    setData(body.data);
    setSelectedListingId((current) => {
      if (tab !== "moderation") return current;
      if (current && body.data.list.items.some((item: { listingId: string }) => String(item.listingId) === current)) {
        return current;
      }
      return body.data.list.items[0] ? String(body.data.list.items[0].listingId) : null;
    });
    setStatus("ready");
  }, [tab, page, listingStatus, reportStatus, q]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runConfirm() {
    if (!confirmAction) return;
    setBusy(true);
    let response: Response;
    if (confirmAction.kind === "moderate") {
      response = await fetch(`/api/v1/admin/moderation/${confirmAction.id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(confirmAction.payload),
      });
    } else if (confirmAction.kind === "suspend") {
      response = await fetch(`/api/v1/admin/users/${confirmAction.id}/suspend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(confirmAction.payload),
      });
    } else if (confirmAction.kind === "license") {
      response = await fetch(`/api/v1/admin/agents/${confirmAction.id}/license`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(confirmAction.payload),
      });
    } else {
      response = await fetch(`/api/v1/admin/reports/${confirmAction.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(confirmAction.payload),
      });
    }
    setBusy(false);
    setConfirmAction(null);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error?.message ?? "Action failed");
      return;
    }
    setNote("");
    await load();
  }

  const selected =
    data?.tab === "moderation"
      ? data.list.items.find((item) => String(item.listingId) === selectedListingId) ?? data.list.items[0]
      : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
      <div className="rounded-2xl border border-line bg-white p-6">
        <p className="text-xs font-bold text-amber">Admin governance</p>
        <h1 className="text-3xl font-extrabold">Moderation and operations</h1>
        <p className="mt-1 text-sm text-muted">
          Approvals, users, agents, reports, and basic marketplace analytics from live database counts.
        </p>
        <dl className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {[
            [String(data?.summary.pendingApprovals ?? "—"), "Pending approvals"],
            [String(data?.summary.publishedListings ?? "—"), "Published"],
            [String(data?.summary.rejectedListings ?? "—"), "Rejected"],
            [String(data?.summary.openReports ?? "—"), "Open reports"],
            [String(data?.summary.usersTotal ?? "—"), "Users"],
            [String(data?.summary.agentsTotal ?? "—"), "Agents"],
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
            ["moderation", "Pending approvals"],
            ["listings", "Listings"],
            ["users", "Users"],
            ["agents", "Agents"],
            ["reports", "Reported listings"],
            ["analytics", "Analytics"],
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
          <LoadingState label="Loading admin dashboard" />
        ) : null}
        {status === "error" ? <ErrorState body={error ?? "Admin dashboard unavailable"} /> : null}
        {status === "ready" && data && data.tab === tab ? (
          <>
            {tab === "moderation" ? (
              data.list.items.length === 0 ? (
                <EmptyState title="No listings awaiting review" body="Submitted listings will appear in this queue." />
              ) : (
                <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
                  <section className="rounded-2xl border border-line bg-white p-3">
                    <h2 className="px-2 py-2 text-sm font-extrabold">Queue</h2>
                    <ul className="grid gap-2">
                      {data.list.items.map((item) => (
                        <li key={String(item.caseId)}>
                          <button
                            type="button"
                            className={`w-full rounded-xl p-3 text-left ${String(item.listingId) === String(selected?.listingId) ? "bg-amber-soft" : "bg-surface-low"}`}
                            onClick={() => setSelectedListingId(String(item.listingId))}
                          >
                            <p className="text-[11px] font-bold text-muted">{String(item.publicCode)}</p>
                            <p className="font-bold">{String(item.title)}</p>
                            <p className="text-sm text-muted">
                              {String(item.city)}, {String(item.province)}
                            </p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                  <section className="rounded-2xl border border-line bg-white p-5">
                    {selected ? (
                      <>
                        <p className="text-xs font-bold text-muted">{String(selected.publicCode)}</p>
                        <h2 className="text-2xl font-extrabold">{String(selected.title)}</h2>
                        <p className="text-sm text-muted">
                          {String(selected.city)} · ₱
                          {Number(centavosToPesos(Number(selected.pricePhpCentavos))).toLocaleString("en-PH")}
                        </p>
                        <TextAreaField label="Note to the lister" value={note} onChange={(event) => setNote(event.target.value)} />
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            onClick={() =>
                              setConfirmAction({
                                kind: "moderate",
                                id: String(selected.listingId),
                                payload: { outcome: "approve", noteToLister: note || undefined },
                                title: "Approve and publish?",
                                body: "Publishing does not certify ownership or clean title.",
                              })
                            }
                          >
                            Approve and publish
                          </Button>
                          <Button
                            type="button"
                            variant="amber"
                            onClick={() =>
                              setConfirmAction({
                                kind: "moderate",
                                id: String(selected.listingId),
                                payload: { outcome: "request_changes", noteToLister: note || "Please revise" },
                                title: "Request changes?",
                                body: "The lister will need to resubmit after editing.",
                              })
                            }
                          >
                            Request changes
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              setConfirmAction({
                                kind: "moderate",
                                id: String(selected.listingId),
                                payload: { outcome: "reject", noteToLister: note || "Rejected" },
                                title: "Reject listing?",
                                body: "A rejection reason will be stored on the listing.",
                              })
                            }
                          >
                            Reject
                          </Button>
                        </div>
                      </>
                    ) : null}
                  </section>
                </div>
              )
            ) : null}

            {tab === "listings" ? (
              <>
                <div className="mb-4 max-w-xs">
                  <SelectField
                    label="Status"
                    value={listingStatus}
                    onChange={(event) => {
                      setListingStatus(event.target.value);
                      setPage(1);
                    }}
                  >
                    {["published", "rejected", "pending_review", "needs_revision", "draft", "archived"].map((value) => (
                      <option key={value} value={value}>
                        {value.replaceAll("_", " ")}
                      </option>
                    ))}
                  </SelectField>
                </div>
                {data.list.items.length === 0 ? (
                  <EmptyState title="No listings in this status" body="Try another status filter." />
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-line bg-white">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="text-xs text-muted">
                        <tr>
                          <th className="px-4 py-3 font-bold">Code</th>
                          <th className="px-4 py-3 font-bold">Title</th>
                          <th className="px-4 py-3 font-bold">Location</th>
                          <th className="px-4 py-3 font-bold">Price</th>
                          <th className="px-4 py-3 font-bold">Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.list.items.map((item) => (
                          <tr key={String(item.id)} className="border-t border-line">
                            <td className="px-4 py-3 font-semibold">{String(item.publicCode)}</td>
                            <td className="px-4 py-3">{String(item.title)}</td>
                            <td className="px-4 py-3">
                              {String(item.city)}, {String(item.province)}
                            </td>
                            <td className="px-4 py-3">
                              ₱{Number(centavosToPesos(Number(item.pricePhpCentavos ?? 0))).toLocaleString("en-PH")}
                            </td>
                            <td className="px-4 py-3">{String(item.moderationNote ?? "—")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : null}

            {tab === "users" ? (
              <>
                <div className="mb-4 flex flex-wrap gap-2">
                  <TextField label="Search users" value={q} onChange={(event) => setQ(event.target.value)} />
                  <div className="self-end">
                    <Button type="button" variant="outline" onClick={() => setPage(1)}>
                      Apply
                    </Button>
                  </div>
                </div>
                {data.list.items.length === 0 ? (
                  <EmptyState title="No users found" body="Try a different search." />
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-line bg-white">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="text-xs text-muted">
                        <tr>
                          <th className="px-4 py-3 font-bold">Name</th>
                          <th className="px-4 py-3 font-bold">Email</th>
                          <th className="px-4 py-3 font-bold">Roles</th>
                          <th className="px-4 py-3 font-bold">Status</th>
                          <th className="px-4 py-3 font-bold">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.list.items.map((item) => (
                          <tr key={String(item.id)} className="border-t border-line">
                            <td className="px-4 py-3 font-semibold">{String(item.fullName)}</td>
                            <td className="px-4 py-3">{String(item.email)}</td>
                            <td className="px-4 py-3">
                              {Array.isArray(item.roles) ? (item.roles as string[]).join(", ") : "—"}
                            </td>
                            <td className="px-4 py-3 capitalize">{String(item.status)}</td>
                            <td className="px-4 py-3">
                              {item.status === "active" ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() =>
                                    setConfirmAction({
                                      kind: "suspend",
                                      id: String(item.id),
                                      payload: { reason: "Suspended by admin from dashboard" },
                                      title: "Suspend user?",
                                      body: `${String(item.fullName)} will lose access until restored manually in a later release.`,
                                    })
                                  }
                                >
                                  Suspend
                                </Button>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : null}

            {tab === "agents" ? (
              data.list.items.length === 0 ? (
                <EmptyState title="No agent profiles" body="Broker profiles appear after agents complete onboarding." />
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-line bg-white">
                  <table className="w-full min-w-[800px] text-left text-sm">
                    <thead className="text-xs text-muted">
                      <tr>
                        <th className="px-4 py-3 font-bold">Agent</th>
                        <th className="px-4 py-3 font-bold">Agency</th>
                        <th className="px-4 py-3 font-bold">PRC</th>
                        <th className="px-4 py-3 font-bold">License review</th>
                        <th className="px-4 py-3 font-bold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.list.items.map((item) => (
                        <tr key={String(item.userId)} className="border-t border-line">
                          <td className="px-4 py-3">
                            <p className="font-semibold">
                              {String(item.displayName ?? item.fullName ?? "—")}
                            </p>
                            <p className="text-xs text-muted">{String(item.email ?? "—")}</p>
                          </td>
                          <td className="px-4 py-3">{String(item.agencyName ?? "—")}</td>
                          <td className="px-4 py-3">{String(item.prcLicenseNo ?? "—")}</td>
                          <td className="px-4 py-3 capitalize">
                            {String(item.licenseReviewStatus ?? "unreviewed").replaceAll("_", " ")}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                onClick={() =>
                                  setConfirmAction({
                                    kind: "license",
                                    id: String(item.userId),
                                    payload: { status: "accepted" },
                                    title: "Accept declared license?",
                                    body: "This marks the self-declared PRC details as reviewed, not government-verified.",
                                  })
                                }
                              >
                                Accept
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                  setConfirmAction({
                                    kind: "license",
                                    id: String(item.userId),
                                    payload: { status: "rejected" },
                                    title: "Reject declared license?",
                                    body: "The agent profile will show a rejected review status.",
                                  })
                                }
                              >
                                Reject
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : null}

            {tab === "reports" ? (
              <>
                <div className="mb-4 max-w-xs">
                  <SelectField
                    label="Report status"
                    value={reportStatus}
                    onChange={(event) => {
                      setReportStatus(event.target.value);
                      setPage(1);
                    }}
                  >
                    {["open", "reviewing", "resolved", "dismissed"].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </SelectField>
                </div>
                {data.list.items.length === 0 ? (
                  <EmptyState title="No reports in this filter" body="Published listing reports from users appear here." />
                ) : (
                  <ul className="grid gap-3">
                    {data.list.items.map((item) => (
                      <li key={String(item.id)} className="rounded-xl border border-line bg-white p-4">
                        <p className="text-xs font-bold text-muted">
                          {String(item.publicCode)} · {String(item.status)}
                        </p>
                        <h3 className="font-extrabold">{String(item.title)}</h3>
                        <p className="mt-1 text-sm text-muted">
                          {String(item.reason)} — {String(item.details ?? "No details")}
                        </p>
                        <p className="mt-1 text-xs text-muted">Reporter: {String(item.reporterEmail ?? "anonymous")}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            onClick={() =>
                              setConfirmAction({
                                kind: "report",
                                id: String(item.id),
                                payload: { status: "resolved", resolutionNote: "Reviewed and resolved" },
                                title: "Resolve report?",
                                body: "Marks the report resolved without automated listing takedown.",
                              })
                            }
                          >
                            Resolve
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              setConfirmAction({
                                kind: "report",
                                id: String(item.id),
                                payload: { status: "dismissed", resolutionNote: "No violation found" },
                                title: "Dismiss report?",
                                body: "Dismisses the report after review.",
                              })
                            }
                          >
                            Dismiss
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : null}

            {tab === "analytics" && data.analytics ? (
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  ["Listings by status", data.analytics.listings],
                  ["Inquiries by status", data.analytics.inquiries],
                  ["Appointments by status", data.analytics.appointments],
                ].map(([title, counts]) => (
                  <section key={String(title)} className="rounded-2xl border border-line bg-white p-5">
                    <h2 className="font-extrabold">{String(title)}</h2>
                    <ul className="mt-3 grid gap-2 text-sm">
                      {Object.entries(counts as Record<string, number>).map(([key, value]) => (
                        <li key={key} className="flex justify-between gap-3 border-t border-line pt-2">
                          <span className="capitalize text-muted">{key.replaceAll("_", " ")}</span>
                          <span className="font-bold">{value}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            ) : null}

            {tab !== "analytics" && data.list.totalPages > 1 ? (
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
        open={Boolean(confirmAction)}
        title={confirmAction?.title ?? ""}
        body={confirmAction?.body ?? ""}
        confirmLabel="Confirm"
        danger={confirmAction?.kind === "suspend" || confirmAction?.payload.outcome === "reject"}
        busy={busy}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => void runConfirm()}
      />
    </div>
  );
}
