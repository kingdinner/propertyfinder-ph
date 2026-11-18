import { Suspense, type ReactNode } from "react";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader, type HeaderUser } from "@/components/layout/SiteHeader";
import { getSessionFromCookies } from "@/lib/auth/service";

function DemoBanner() {
  return (
    <p className="bg-ink-strong px-4 py-2 text-center text-xs font-semibold text-white">
      Demo content: sample property listings and figures are illustrative.
    </p>
  );
}

function HeaderFallback() {
  return <div className="h-16 border-b border-line bg-white" aria-hidden="true" />;
}

async function resolveHeaderUser(): Promise<HeaderUser | null> {
  try {
    const session = await getSessionFromCookies();
    if (!session?.user) return null;
    return {
      fullName: session.user.fullName,
      roles: session.user.roles,
    };
  } catch {
    return null;
  }
}

export async function PublicShell({ children }: { children: ReactNode }) {
  const user = await resolveHeaderUser();
  return (
    <div className="flex min-h-screen flex-col" data-layout="public">
      <DemoBanner />
      <Suspense fallback={<HeaderFallback />}>
        <SiteHeader authenticated={Boolean(user)} initialUser={user} />
      </Suspense>
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

export async function AuthenticatedShell({ children }: { children: ReactNode }) {
  const user = await resolveHeaderUser();
  return (
    <div className="flex min-h-screen flex-col" data-layout="authenticated">
      <DemoBanner />
      <Suspense fallback={<HeaderFallback />}>
        <SiteHeader authenticated initialUser={user} />
      </Suspense>
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
