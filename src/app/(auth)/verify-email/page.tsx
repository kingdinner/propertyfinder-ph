"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function VerifyEmailClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [message, setMessage] = useState("Verifying your email…");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Missing verification token.");
      return;
    }
    void fetch("/api/v1/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          setStatus("error");
          setMessage(payload?.error?.message ?? "Verification failed");
          return;
        }
        setStatus("ok");
        setMessage("Email verified. You can continue using your account.");
      })
      .catch(() => {
        setStatus("error");
        setMessage("Verification failed");
      });
  }, [token]);

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-extrabold">Email verification</h1>
      <p className={`mt-3 text-sm ${status === "error" ? "text-danger" : "text-muted"}`}>{message}</p>
      <Link href="/dashboard" className="mt-4 inline-flex text-sm font-bold text-amber">
        Go to dashboard
      </Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md text-sm text-muted">Loading…</div>}>
      <VerifyEmailClient />
    </Suspense>
  );
}
