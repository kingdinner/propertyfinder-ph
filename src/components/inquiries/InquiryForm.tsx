"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextAreaField, TextField } from "@/components/ui/Fields";

export function InquiryForm({ listingId }: { listingId: string }) {
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [message, setMessage] = useState("");
  const [viewingAt, setViewingAt] = useState("");
  const [requestViewing, setRequestViewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const inquiryResponse = await fetch("/api/v1/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId,
          contactName,
          contactPhone: contactPhone || undefined,
          message,
        }),
      });
      if (inquiryResponse.status === 401) {
        window.location.assign(`/login?next=${encodeURIComponent(`/listings/${listingId}`)}`);
        return;
      }
      const inquiryBody = await inquiryResponse.json();
      if (!inquiryResponse.ok) {
        throw new Error(inquiryBody?.error?.message ?? "Could not send inquiry");
      }

      if (requestViewing && viewingAt) {
        const appointmentResponse = await fetch("/api/v1/appointments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inquiryId: inquiryBody.data.inquiry.id,
            startsAt: viewingAt,
            contactPhone: contactPhone || undefined,
            note: "Requested with inquiry",
          }),
        });
        const appointmentBody = await appointmentResponse.json();
        if (!appointmentResponse.ok) {
          throw new Error(appointmentBody?.error?.message ?? "Inquiry sent, but viewing request failed");
        }
        setSuccess(
          `Inquiry sent. Viewing requested for ${appointmentBody.data.appointment.startsAtManila} (Asia/Manila).`,
        );
      } else {
        setSuccess("Inquiry sent to the listing owner/agent.");
      }
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="mt-4 grid gap-3" onSubmit={(event) => void onSubmit(event)}>
      <TextField
        label="Your name"
        name="name"
        autoComplete="name"
        value={contactName}
        onChange={(event) => setContactName(event.target.value)}
        required
      />
      <TextField
        label="Mobile"
        name="phone"
        autoComplete="tel"
        value={contactPhone}
        onChange={(event) => setContactPhone(event.target.value)}
      />
      <TextAreaField
        label="Inquiry"
        name="message"
        placeholder="Ask about a viewing"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        required
      />
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          checked={requestViewing}
          onChange={(event) => setRequestViewing(event.target.checked)}
        />
        Also request a viewing
      </label>
      {requestViewing ? (
        <TextField
          label="Preferred viewing (Asia/Manila)"
          name="viewingAt"
          type="datetime-local"
          value={viewingAt}
          onChange={(event) => setViewingAt(event.target.value)}
          hint="Times are interpreted in Asia/Manila."
          required={requestViewing}
        />
      ) : null}
      {error ? <p className="text-sm font-semibold text-danger">{error}</p> : null}
      {success ? <p className="text-sm font-semibold text-ok">{success}</p> : null}
      <Button type="submit" variant="amber" className="w-full" disabled={busy}>
        Send inquiry
      </Button>
    </form>
  );
}
