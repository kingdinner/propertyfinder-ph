"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PropertyCard } from "@/components/property/PropertyCard";
import { Button } from "@/components/ui/Button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Fields";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import {
  emptyListingForm,
  formToPayload,
  listingToForm,
  showsBedrooms,
  showsFloorArea,
  showsLotArea,
  type ListingFormState,
} from "@/lib/listings/form";

type MediaItem = { id: string; url: string; isCover: boolean };

type ListingRecord = {
  id: string;
  publicCode: string;
  status: string;
  moderationNote: string | null;
  media: MediaItem[];
} & Parameters<typeof listingToForm>[0];

const FINANCING = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank financing" },
  { value: "in_house", label: "In-house" },
  { value: "pagibig", label: "Pag-IBIG" },
] as const;

async function readError(response: Response) {
  const body = await response.json().catch(() => null);
  return body?.error?.message ?? "Request failed";
}

export function ListingWizard({ initial }: { initial?: ListingRecord }) {
  const router = useRouter();
  const [form, setForm] = useState<ListingFormState>(initial ? listingToForm(initial) : emptyListingForm());
  const [listingId, setListingId] = useState(initial?.id ?? "");
  const [status, setStatus] = useState(initial?.status ?? "draft");
  const [publicCode, setPublicCode] = useState(initial?.publicCode ?? "");
  const [moderationNote, setModerationNote] = useState(initial?.moderationNote ?? null);
  const [media, setMedia] = useState<MediaItem[]>(initial?.media ?? []);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const editable = status === "draft" || status === "needs_revision" || status === "rejected";
  const canResubmit = status === "needs_revision" || status === "rejected";
  const canSubmit = status === "draft";
  const canArchive = status !== "archived";

  const preview = useMemo(
    () => ({
      id: listingId || "draft",
      title: form.title || "Untitled listing",
      transaction: form.transaction,
      category: form.category,
      priceCentavos: Math.round(Number(form.pricePhp.replace(/,/g, "") || 0) * 100),
      location: [form.subdivision, form.barangay, form.city, form.province].filter(Boolean).join(", ") || "Philippines",
      city: form.city || "—",
      bedrooms: form.bedrooms,
      bathrooms: form.bathrooms,
      floorAreaSqm: form.floorAreaSqm ?? form.lotAreaSqm ?? 0,
      parking: form.parkingSlots,
      broker: "You",
      prcLicense: publicCode || "Draft",
      badge: status.replaceAll("_", " "),
      tone: (status === "published" ? (form.transaction === "rent" ? "rent" : "sale") : "review") as
        | "sale"
        | "rent"
        | "review",
    }),
    [form, listingId, publicCode, status],
  );

  function patch<K extends keyof ListingFormState>(key: K, value: ListingFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveDraft() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const payload = formToPayload(form);
      const response = await fetch(listingId ? `/api/v1/listings/${listingId}` : "/api/v1/listings", {
        method: listingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await readError(response));
      const body = await response.json();
      const listing = body.data.listing as ListingRecord;
      setListingId(listing.id);
      setStatus(listing.status);
      setPublicCode(listing.publicCode);
      setMedia(listing.media);
      setMessage("Draft saved.");
      if (!initial) router.replace(`/list/${listing.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save draft");
    } finally {
      setBusy(false);
    }
  }

  async function submitForReview() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      let id = listingId;
      if (!id) {
        const created = await fetch("/api/v1/listings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formToPayload(form)),
        });
        if (!created.ok) throw new Error(await readError(created));
        const createdBody = await created.json();
        id = createdBody.data.listing.id;
        setListingId(id);
      } else {
        const saved = await fetch(`/api/v1/listings/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formToPayload(form)),
        });
        if (!saved.ok) throw new Error(await readError(saved));
      }
      const endpoint = canResubmit ? "resubmit" : "submit";
      const response = await fetch(`/api/v1/listings/${id}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formToPayload(form)),
      });
      if (!response.ok) throw new Error(await readError(response));
      const body = await response.json();
      const listing = body.data.listing as ListingRecord;
      setStatus(listing.status);
      setPublicCode(listing.publicCode);
      setModerationNote(listing.moderationNote);
      setMessage(canResubmit ? "Listing resubmitted for review." : "Listing submitted for review.");
      router.replace(`/list/${listing.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit listing");
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    if (!listingId) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/listings/${listingId}/archive`, { method: "POST" });
      if (!response.ok) throw new Error(await readError(response));
      const body = await response.json();
      setStatus(body.data.listing.status);
      setMessage("Listing archived.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not archive listing");
    } finally {
      setBusy(false);
    }
  }

  async function uploadImage(file: File) {
    if (!listingId) {
      setError("Save a draft before uploading photos.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = new FormData();
      data.set("file", file);
      const response = await fetch(`/api/v1/listings/${listingId}/media`, { method: "POST", body: data });
      if (!response.ok) throw new Error(await readError(response));
      const body = await response.json();
      setMedia(body.data.listing.media);
      setMessage("Photo uploaded.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  function toggleFinancing(value: (typeof FINANCING)[number]["value"]) {
    setForm((current) => {
      const exists = current.financingOptions.includes(value);
      return {
        ...current,
        financingOptions: exists
          ? current.financingOptions.filter((item) => item !== value)
          : [...current.financingOptions, value],
      };
    });
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 lg:grid-cols-[1fr_320px] lg:px-6">
      <form
        className="grid gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          void saveDraft();
        }}
      >
        <div>
          <p className="text-xs font-bold text-amber">Listing wizard</p>
          <h1 className="text-3xl font-extrabold">{listingId ? "Edit listing" : "List your property"}</h1>
          <p className="mt-1 text-sm text-muted">
            {publicCode ? `${publicCode} · ` : ""}
            Status: {status.replaceAll("_", " ")}
          </p>
          {moderationNote ? (
            <p className="mt-2 rounded-lg bg-surface-low px-3 py-2 text-sm text-ink">
              Moderator note: {moderationNote}
            </p>
          ) : null}
          <p className="mt-2 text-sm">
            <Link href="/agent" className="font-semibold text-amber underline-offset-2 hover:underline">
              Back to my listings
            </Link>
          </p>
        </div>

        {error ? <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">{error}</p> : null}
        {message ? <p className="rounded-lg bg-surface-low px-3 py-2 text-sm font-semibold text-ink">{message}</p> : null}

        <section className="grid gap-4 rounded-2xl border border-line bg-white p-5">
          <h2 className="font-extrabold">Transaction and category</h2>
          <SegmentedControl
            label="Listing type"
            value={form.transaction}
            onChange={(value) => patch("transaction", value as ListingFormState["transaction"])}
            options={[
              { value: "sale", label: "For sale" },
              { value: "rent", label: "For rent" },
            ]}
          />
          <SelectField
            label="Property category"
            name="category"
            value={form.category}
            disabled={!editable}
            onChange={(event) => patch("category", event.target.value as ListingFormState["category"])}
          >
            <option value="house_lot">House & lot</option>
            <option value="condo">Condominium</option>
            <option value="townhouse">Townhouse</option>
            <option value="lot">Vacant lot</option>
            <option value="commercial">Commercial</option>
          </SelectField>
        </section>

        <section className="grid gap-4 rounded-2xl border border-line bg-white p-5">
          <h2 className="font-extrabold">Basic information</h2>
          <TextField
            label="Listing title"
            name="title"
            value={form.title}
            disabled={!editable}
            onChange={(event) => patch("title", event.target.value)}
          />
          <SelectField
            label="Construction status"
            name="constructionStatus"
            value={form.constructionStatus}
            disabled={!editable}
            onChange={(event) =>
              patch("constructionStatus", event.target.value as ListingFormState["constructionStatus"])
            }
          >
            <option value="rfo">Ready for occupancy</option>
            <option value="preselling">Pre-selling</option>
            <option value="resale">Resale</option>
          </SelectField>
          <SegmentedControl
            label="Furnishing"
            value={form.furnishing}
            onChange={(value) => patch("furnishing", value as ListingFormState["furnishing"])}
            options={[
              { value: "unfurnished", label: "Unfurnished" },
              { value: "semi_furnished", label: "Semi-furnished" },
              { value: "furnished", label: "Furnished" },
            ]}
          />
          <TextAreaField
            label="Description"
            name="description"
            value={form.description}
            disabled={!editable}
            onChange={(event) => patch("description", event.target.value)}
          />
        </section>

        <section className="grid gap-4 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2">
          <h2 className="font-extrabold sm:col-span-2">Specifications</h2>
          {showsBedrooms(form.category) ? (
            <>
              <TextField
                label="Bedrooms"
                name="bedrooms"
                type="number"
                value={form.bedrooms}
                disabled={!editable}
                onChange={(event) => patch("bedrooms", Number(event.target.value))}
              />
              <TextField
                label="Bathrooms"
                name="bathrooms"
                type="number"
                value={form.bathrooms}
                disabled={!editable}
                onChange={(event) => patch("bathrooms", Number(event.target.value))}
              />
              <TextField
                label="Powder rooms"
                name="powderRooms"
                type="number"
                value={form.powderRooms}
                disabled={!editable}
                onChange={(event) => patch("powderRooms", Number(event.target.value))}
              />
            </>
          ) : null}
          <TextField
            label="Parking slots"
            name="parkingSlots"
            type="number"
            value={form.parkingSlots}
            disabled={!editable}
            onChange={(event) => patch("parkingSlots", Number(event.target.value))}
          />
          {showsFloorArea(form.category) ? (
            <TextField
              label="Floor area (sqm)"
              name="floorAreaSqm"
              type="number"
              value={form.floorAreaSqm ?? ""}
              disabled={!editable}
              onChange={(event) =>
                patch("floorAreaSqm", event.target.value === "" ? null : Number(event.target.value))
              }
            />
          ) : null}
          {showsLotArea(form.category) ? (
            <TextField
              label="Lot area (sqm)"
              name="lotAreaSqm"
              type="number"
              value={form.lotAreaSqm ?? ""}
              disabled={!editable}
              onChange={(event) =>
                patch("lotAreaSqm", event.target.value === "" ? null : Number(event.target.value))
              }
            />
          ) : null}
          <SelectField
            label="Declared title status"
            name="declaredTitleStatus"
            value={form.declaredTitleStatus}
            disabled={!editable}
            onChange={(event) =>
              patch("declaredTitleStatus", event.target.value as ListingFormState["declaredTitleStatus"])
            }
          >
            <option value="clean_tct_cct">Clean title (declared)</option>
            <option value="mortgaged">Mortgaged</option>
            <option value="tax_declaration">Tax declaration only</option>
            <option value="estate_settlement">Estate settlement</option>
            <option value="unspecified">Unspecified</option>
          </SelectField>
          <TextField
            label="RPT status"
            name="rptStatus"
            value={form.rptStatus}
            disabled={!editable}
            onChange={(event) => patch("rptStatus", event.target.value)}
          />
        </section>

        <section className="grid gap-4 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2">
          <h2 className="font-extrabold sm:col-span-2">Philippine location</h2>
          <TextField
            label="Province"
            name="province"
            value={form.province}
            disabled={!editable}
            onChange={(event) => patch("province", event.target.value)}
          />
          <TextField
            label="City / municipality"
            name="city"
            value={form.city}
            disabled={!editable}
            onChange={(event) => patch("city", event.target.value)}
          />
          <TextField
            label="Barangay"
            name="barangay"
            value={form.barangay}
            disabled={!editable}
            onChange={(event) => patch("barangay", event.target.value)}
          />
          <TextField
            label="Postal code"
            name="postalCode"
            value={form.postalCode}
            disabled={!editable}
            onChange={(event) => patch("postalCode", event.target.value)}
          />
          <TextField
            label="Subdivision / village"
            name="subdivision"
            value={form.subdivision}
            disabled={!editable}
            onChange={(event) => patch("subdivision", event.target.value)}
          />
          <TextField
            label="Street address"
            name="streetAddress"
            value={form.streetAddress}
            disabled={!editable}
            onChange={(event) => patch("streetAddress", event.target.value)}
          />
        </section>

        <section className="rounded-2xl border border-dashed border-line bg-white p-5">
          <h2 className="font-extrabold">Photos</h2>
          <p className="mt-2 text-sm text-muted">JPEG, PNG, or WebP up to 8MB. Save a draft first, then upload.</p>
          <input
            className="mt-3 block w-full text-sm"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={!editable || busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadImage(file);
              event.target.value = "";
            }}
          />
          {media.length > 0 ? (
            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {media.map((item) => (
                <li key={item.id} className="overflow-hidden rounded-lg bg-surface-low">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.url} alt="" className="h-28 w-full object-cover" />
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="grid gap-4 rounded-2xl border border-line bg-white p-5">
          <h2 className="font-extrabold">{form.transaction === "rent" ? "Monthly rent" : "Asking price"}</h2>
          <TextField
            label={form.transaction === "rent" ? "Monthly rent (PHP)" : "Asking price (PHP)"}
            name="pricePhp"
            inputMode="decimal"
            value={form.pricePhp}
            disabled={!editable}
            onChange={(event) => patch("pricePhp", event.target.value)}
          />
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={form.priceNegotiable}
              disabled={!editable}
              onChange={(event) => patch("priceNegotiable", event.target.checked)}
            />
            Price negotiable
          </label>
          {form.transaction === "sale" ? (
            <fieldset className="grid gap-2">
              <legend className="text-sm font-semibold">Accepted payment options</legend>
              {FINANCING.map((option) => (
                <label key={option.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.financingOptions.includes(option.value)}
                    disabled={!editable}
                    onChange={() => toggleFinancing(option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>
          ) : (
            <p className="text-sm text-muted">Rent listings use monthly price only. Financing options are for sale.</p>
          )}
          <TextField
            label="Assigned broker user ID (optional)"
            name="brokerUserId"
            value={form.brokerUserId}
            disabled={!editable}
            hint="Paste a REAL_ESTATE_AGENT user UUID to assign an agent."
            onChange={(event) => patch("brokerUserId", event.target.value)}
          />
        </section>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="amber" disabled={!editable || busy}>
            Save draft
          </Button>
          {(canSubmit || canResubmit) && (
            <Button type="button" disabled={busy} onClick={() => void submitForReview()}>
              {canResubmit ? "Resubmit for review" : "Submit for review"}
            </Button>
          )}
          {listingId && canArchive ? (
            <Button type="button" variant="ghost" disabled={busy} onClick={() => void archive()}>
              Archive
            </Button>
          ) : null}
        </div>
      </form>
      <aside className="h-fit lg:sticky lg:top-24">
        <p className="mb-2 text-xs font-bold text-muted">Card preview</p>
        <PropertyCard listing={preview} />
      </aside>
    </div>
  );
}
