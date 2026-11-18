import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";

export function AuthSplit({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(280px,420px)_1fr]" data-layout="auth">
      <aside className="flex flex-col justify-between bg-ink-strong p-8 text-white">
        <div>
          <Logo inverted />
          <p className="mt-8 text-3xl font-extrabold leading-tight">Find, list, and inquire on Philippine properties.</p>
          <p className="mt-4 text-sm text-amber-soft">
            Buyers, renters, owners, and brokers share one account. Identity document upload is not part of this foundation.
          </p>
        </div>
        <ul className="mt-8 grid gap-3 text-sm">
          <li className="rounded-xl bg-white/10 p-3">Search sale and rent listings in one marketplace.</li>
          <li className="rounded-xl bg-white/10 p-3">Owners and brokers submit listings for review before they are public.</li>
          <li className="rounded-xl bg-white/10 p-3">Personal data is collected only with Data Privacy Act consent.</li>
        </ul>
      </aside>
      <div className="bg-canvas px-4 py-8 sm:px-10">{children}</div>
    </div>
  );
}
