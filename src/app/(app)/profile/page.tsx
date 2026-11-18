"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextAreaField, TextField } from "@/components/ui/Fields";
import { SelectField } from "@/components/ui/Fields";

type PublicUser = {
  id: string;
  email: string;
  fullName: string;
  phoneE164: string | null;
  roles: string[];
  activePortal: string | null;
  brokerProfile: {
    displayName: string;
    agencyName: string | null;
    prcLicenseNo: string | null;
    dhsudRegistrationNo: string | null;
    bio: string | null;
  } | null;
};

export default function ProfilePage() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void fetch("/api/v1/profiles/me")
      .then((response) => response.json())
      .then((payload) => {
        if (payload.ok) setUser(payload.data.user);
      });
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setPending(true);
    setError(undefined);
    setMessage(undefined);
    const form = new FormData(event.currentTarget);
    const body: Record<string, unknown> = {
      fullName: form.get("fullName"),
      phone: form.get("phone") || "",
      activePortal: form.get("activePortal") || null,
    };
    if (user.roles.includes("REAL_ESTATE_AGENT")) {
      body.broker = {
        displayName: form.get("displayName") || user.fullName,
        agencyName: form.get("agencyName") || "",
        prcLicenseNo: form.get("prcLicenseNo") || "",
        dhsudRegistrationNo: form.get("dhsudRegistrationNo") || "",
        bio: form.get("bio") || "",
      };
    }
    const response = await fetch("/api/v1/profiles/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    setPending(false);
    if (!response.ok) {
      setError(payload?.error?.message ?? "Unable to save profile");
      return;
    }
    setUser(payload.data.user);
    setMessage("Profile saved.");
  }

  if (!user) {
    return <div className="mx-auto max-w-3xl px-4 py-8 text-sm text-muted">Loading profile…</div>;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:px-6">
      <h1 className="text-3xl font-extrabold">Your profile</h1>
      <p className="mt-1 text-sm text-muted">{user.email}</p>
      <form className="mt-6 grid gap-4 rounded-2xl border border-line bg-white p-5" onSubmit={onSubmit}>
        <TextField label="Full name" name="fullName" defaultValue={user.fullName} required />
        <TextField label="Mobile number" name="phone" defaultValue={user.phoneE164 ?? ""} />
        <SelectField label="Active portal" name="activePortal" defaultValue={user.activePortal ?? ""}>
          <option value="">No preference</option>
          {user.roles.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </SelectField>
        {user.roles.includes("REAL_ESTATE_AGENT") ? (
          <>
            <TextField label="Broker display name" name="displayName" defaultValue={user.brokerProfile?.displayName ?? user.fullName} />
            <TextField label="Agency" name="agencyName" defaultValue={user.brokerProfile?.agencyName ?? ""} />
            <TextField label="PRC license number" name="prcLicenseNo" defaultValue={user.brokerProfile?.prcLicenseNo ?? ""} />
            <TextField label="DHSUD registration" name="dhsudRegistrationNo" defaultValue={user.brokerProfile?.dhsudRegistrationNo ?? ""} />
            <TextAreaField label="Bio" name="bio" defaultValue={user.brokerProfile?.bio ?? ""} />
          </>
        ) : null}
        {error ? <p role="alert" className="text-sm font-semibold text-danger">{error}</p> : null}
        {message ? <p className="text-sm font-semibold text-ok">{message}</p> : null}
        <Button type="submit" variant="amber" disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </Button>
      </form>
    </div>
  );
}
