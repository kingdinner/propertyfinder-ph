"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Fields";
import { homeForRoles, safeNextPath } from "@/lib/auth/redirect";

const DEMO_ACCOUNTS = [
  {
    label: "Customer",
    email: "alex.mercado@example.com",
    password: "DemoPass1!",
    note: "Favorites, inquiries, viewings",
  },
  {
    label: "Owner",
    email: "owner.lipa@example.com",
    password: "DemoPass1!",
    note: "Listings + owner portal",
  },
  {
    label: "Agent",
    email: "maria.santos@example.com",
    password: "DemoPass1!",
    note: "Broker listings + assigned leads",
  },
  {
    label: "Admin",
    email: "admin@propertyfinder.ph",
    password: "ChangeMeAdmin1!",
    note: "Moderation + platform admin",
  },
] as const;

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/v1/auth/me", { credentials: "same-origin" })
      .then(async (response) => {
        if (cancelled || !response.ok) return;
        const payload = await response.json().catch(() => null);
        if (!payload?.ok) return;
        const roles = payload.data?.user?.roles ?? [];
        const next = safeNextPath(searchParams.get("next"), homeForRoles(roles));
        router.replace(next);
        router.refresh();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    const response = await fetch("/api/v1/auth/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const payload = await response.json().catch(() => null);
    setPending(false);
    if (!response.ok) {
      setError(payload?.error?.message ?? "Unable to sign in");
      return;
    }
    const roles = payload?.data?.user?.roles ?? [];
    const next = safeNextPath(searchParams.get("next"), homeForRoles(roles));
    // Full navigation so public/app shells all pick up the session cookie.
    window.location.assign(next);
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-6 flex gap-2 rounded-full bg-surface-mid p-1 text-sm font-bold">
        <span className="flex-1 rounded-full bg-white py-2 text-center">Sign in</span>
        <Link href="/register" className="flex-1 py-2 text-center text-muted">
          Create account
        </Link>
      </div>
      <h1 className="text-2xl font-extrabold">Welcome back</h1>
      <p className="mt-1 text-sm text-muted">Use the email on your PropertyFinder PH account.</p>

      <div className="mt-5 rounded-2xl border border-line bg-surface-low p-4">
        <p className="text-xs font-bold tracking-wide text-amber">Demo accounts</p>
        <p className="mt-1 text-xs text-muted">Click a role to fill the form, then sign in.</p>
        <div className="mt-3 grid gap-2">
          {DEMO_ACCOUNTS.map((account) => {
            const selected = email === account.email;
            return (
              <button
                key={account.email}
                type="button"
                onClick={() => {
                  setEmail(account.email);
                  setPassword(account.password);
                  setError(undefined);
                }}
                className={`rounded-xl border px-3 py-2 text-left transition ${
                  selected ? "border-amber bg-white" : "border-line bg-white hover:border-amber/50"
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-extrabold text-ink">{account.label}</span>
                  <span className="text-[11px] font-semibold text-muted">{account.email}</span>
                </span>
                <span className="mt-0.5 block text-xs text-muted">{account.note}</span>
              </button>
            );
          })}
        </div>
      </div>

      <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
        <TextField
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error ? (
          <p role="alert" className="text-sm font-semibold text-danger">
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="amber" className="w-full" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
        <Link href="/forgot-password" className="text-sm font-bold text-amber">
          Forgot password?
        </Link>
      </form>
    </div>
  );
}
