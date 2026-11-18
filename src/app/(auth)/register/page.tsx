"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CheckboxField, TextField } from "@/components/ui/Fields";

const roles = [
  { id: "CUSTOMER", title: "Buyer / renter", detail: "Save listings and send inquiries" },
  { id: "PROPERTY_OWNER", title: "Property owner", detail: "Submit a listing for review" },
  { id: "REAL_ESTATE_AGENT", title: "Licensed broker", detail: "Manage inquiries on your listings" },
] as const;

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<(typeof roles)[number]["id"]>("CUSTOMER");
  const [error, setError] = useState<string>();
  const [consentError, setConsentError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (!data.get("consent")) {
      setConsentError("Consent is required before an account can be created.");
      return;
    }
    setConsentError(undefined);
    setPending(true);
    setError(undefined);
    const response = await fetch("/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: data.get("name"),
        phone: data.get("phone") || "",
        email: data.get("email"),
        password: data.get("password"),
        role,
        consent: true,
      }),
    });
    const payload = await response.json();
    setPending(false);
    if (!response.ok) {
      setError(payload?.error?.message ?? "Unable to create account");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex gap-2 rounded-full bg-surface-mid p-1 text-sm font-bold">
        <Link href="/login" className="flex-1 py-2 text-center text-muted">
          Sign in
        </Link>
        <span className="flex-1 rounded-full bg-white py-2 text-center">Create account</span>
      </div>
      <h1 className="text-2xl font-extrabold">Create your account</h1>
      <p className="mt-1 text-sm text-muted">Choose a role. You can open other portals later from the same account.</p>
      <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
        <fieldset>
          <legend className="text-sm font-semibold">Platform role</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {roles.map((item) => (
              <label key={item.id} className={`rounded-xl border p-3 text-sm ${role === item.id ? "border-amber bg-amber-soft" : "border-line bg-white"}`}>
                <input
                  className="sr-only"
                  type="radio"
                  name="role"
                  value={item.id}
                  checked={role === item.id}
                  onChange={() => setRole(item.id)}
                />
                <span className="block font-bold">{item.title}</span>
                <span className="mt-1 block text-xs text-muted">{item.detail}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <TextField label="Full name" name="name" autoComplete="name" required />
        <TextField label="Mobile number" name="phone" autoComplete="tel" hint="Philippine or overseas number" />
        <TextField label="Email address" name="email" type="email" autoComplete="email" required />
        <TextField label="Password" name="password" type="password" autoComplete="new-password" hint="At least 8 characters" minLength={8} required />
        <CheckboxField label="I agree to the Terms of Service and consent to processing under the Data Privacy Act of 2012." name="consent" error={consentError} />
        {error ? (
          <p role="alert" className="text-sm font-semibold text-danger">
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="amber" className="w-full" disabled={pending}>
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </div>
  );
}
