"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Fields";

export default function ForgotPasswordPage() {
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/v1/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email") }),
    });
    const payload = await response.json();
    setPending(false);
    if (!response.ok) {
      setError(payload?.error?.message ?? "Unable to start reset");
      return;
    }
    setMessage(payload.data.message);
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-extrabold">Forgot password</h1>
      <p className="mt-1 text-sm text-muted">We will email a reset link if that account exists.</p>
      <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
        <TextField label="Email address" name="email" type="email" autoComplete="email" required />
        {error ? <p role="alert" className="text-sm font-semibold text-danger">{error}</p> : null}
        {message ? <p className="text-sm font-semibold text-ok">{message}</p> : null}
        <Button type="submit" variant="amber" disabled={pending}>
          {pending ? "Sending…" : "Send reset link"}
        </Button>
        <Link href="/login" className="text-sm font-bold text-amber">
          Back to sign in
        </Link>
      </form>
    </div>
  );
}
