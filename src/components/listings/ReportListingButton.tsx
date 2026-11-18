"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextAreaField, TextField } from "@/components/ui/Fields";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function ReportListingButton({ listingId }: { listingId: string }) {
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/v1/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, reason, details: details || undefined }),
    });
    setBusy(false);
    if (response.status === 401) {
      window.location.assign(`/login?next=${encodeURIComponent(`/listings/${listingId}`)}`);
      return;
    }
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error?.message ?? "Could not submit report");
      setConfirmOpen(false);
      return;
    }
    setConfirmOpen(false);
    setOpen(false);
    setReason("");
    setDetails("");
  }

  return (
    <div className="mt-4">
      <Button type="button" variant="ghost" onClick={() => setOpen((value) => !value)}>
        Report listing
      </Button>
      {open ? (
        <div className="mt-3 grid gap-3 rounded-xl bg-surface-low p-3">
          <TextField label="Reason" value={reason} onChange={(event) => setReason(event.target.value)} />
          <TextAreaField label="Details" value={details} onChange={(event) => setDetails(event.target.value)} />
          {error ? <p className="text-sm font-semibold text-danger">{error}</p> : null}
          <Button type="button" variant="outline" onClick={() => setConfirmOpen(true)} disabled={!reason.trim()}>
            Submit report
          </Button>
        </div>
      ) : null}
      <ConfirmDialog
        open={confirmOpen}
        title="Submit listing report?"
        body="Reports are reviewed by administrators. False reports may affect your account standing."
        confirmLabel="Submit"
        busy={busy}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void submit()}
      />
    </div>
  );
}
