"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Fields";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/v1/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        password: form.get("password"),
      }),
    });
    const payload = await response.json();
    setPending(false);
    if (!response.ok) {
      setError(payload?.error?.message ?? "Unable to reset password");
      return;
    }
    router.push("/login");
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-extrabold">Choose a new password</h1>
      <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
        <TextField label="New password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        {error ? <p role="alert" className="text-sm font-semibold text-danger">{error}</p> : null}
        <Button type="submit" variant="amber" disabled={pending || !token}>
          {pending ? "Updating…" : "Update password"}
        </Button>
        <Link href="/login" className="text-sm font-bold text-amber">
          Back to sign in
        </Link>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md text-sm text-muted">Loading…</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
