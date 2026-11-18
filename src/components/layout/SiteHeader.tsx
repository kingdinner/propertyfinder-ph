"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { loginHref } from "@/lib/auth/redirect";

type NavLink = {
  href: string;
  label: string;
  isActive: (pathname: string, transaction: string | null) => boolean;
};

const publicLinks: NavLink[] = [
  {
    href: "/search?transaction=sale",
    label: "Buy",
    isActive: (pathname, transaction) => pathname === "/search" && transaction === "sale",
  },
  {
    href: "/search?transaction=rent",
    label: "Rent",
    isActive: (pathname, transaction) => pathname === "/search" && transaction === "rent",
  },
  {
    href: "/search",
    label: "Explore",
    isActive: (pathname, transaction) => pathname === "/search" && transaction !== "sale" && transaction !== "rent",
  },
];

const portalLinks: Array<NavLink & { roles?: string[] }> = [
  { href: "/dashboard", label: "Dashboard", isActive: (pathname) => pathname === "/dashboard" },
  { href: "/profile", label: "Profile", isActive: (pathname) => pathname === "/profile" },
  {
    href: "/list",
    label: "List property",
    isActive: (pathname) => pathname === "/list" || pathname.startsWith("/list/"),
    roles: ["PROPERTY_OWNER", "REAL_ESTATE_AGENT", "ADMIN"],
  },
  {
    href: "/agent",
    label: "Agent",
    isActive: (pathname) => pathname === "/agent",
    roles: ["PROPERTY_OWNER", "REAL_ESTATE_AGENT", "ADMIN"],
  },
  {
    href: "/admin",
    label: "Admin",
    isActive: (pathname) => pathname === "/admin",
    roles: ["ADMIN"],
  },
];

function linkClass(active: boolean) {
  return active
    ? "rounded-lg px-3 py-2 text-sm font-bold bg-surface-mid text-ink"
    : "rounded-lg px-3 py-2 text-sm font-bold text-muted hover:text-ink";
}

export type HeaderUser = {
  fullName: string;
  roles: string[];
};

export function SiteHeader({
  authenticated = false,
  initialUser = null,
}: {
  authenticated?: boolean;
  initialUser?: HeaderUser | null;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(authenticated || Boolean(initialUser));
  const [displayName, setDisplayName] = useState(initialUser?.fullName ?? "Account");
  const [roles, setRoles] = useState<string[]>(initialUser?.roles ?? []);
  const visiblePortal = portalLinks.filter(
    (link) => !link.roles || link.roles.some((role) => roles.includes(role)),
  );
  const links = signedIn ? [...publicLinks, ...visiblePortal] : publicLinks;
  const canList = roles.some((role) => ["PROPERTY_OWNER", "REAL_ESTATE_AGENT", "ADMIN"].includes(role));
  const transaction = searchParams.get("transaction");
  const search = searchParams.toString();
  const currentNext = `${pathname}${search ? `?${search}` : ""}`;
  const signInHref = loginHref(currentNext === "/" ? "/dashboard" : currentNext);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/v1/auth/me", { credentials: "same-origin" })
      .then(async (response) => {
        if (cancelled) return;
        if (response.status === 401) {
          setSignedIn(false);
          setRoles([]);
          setDisplayName("Account");
          return;
        }
        const payload = await response.json().catch(() => null);
        if (payload?.ok && payload.data?.user) {
          setSignedIn(true);
          setDisplayName(payload.data.user.fullName ?? "Account");
          setRoles(payload.data.user.roles ?? []);
          return;
        }
        setSignedIn(false);
        setRoles([]);
      })
      .catch(() => {
        if (!cancelled) setSignedIn(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  async function logout() {
    await fetch("/api/v1/auth/logout", { method: "POST", credentials: "same-origin" });
    setSignedIn(false);
    setRoles([]);
    setDisplayName("Account");
    window.location.assign("/login");
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 lg:px-6">
        <Logo />
        <nav className="ml-2 hidden min-w-0 flex-1 items-center gap-1 overflow-x-auto lg:flex" aria-label="Primary">
          {links.map((link) => {
            const active = ready && link.isActive(pathname, transaction);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`${linkClass(active)} shrink-0`}
                aria-current={active ? "page" : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden rounded-full bg-surface-low px-3 py-1 text-xs font-bold text-ink sm:inline">PHP</span>
          {signedIn ? (
            <>
              {canList ? (
                <Link
                  href="/list"
                  className="hidden h-10 items-center rounded-lg bg-amber px-3 text-sm font-bold text-white sm:inline-flex"
                >
                  + List
                </Link>
              ) : null}
              {roles.includes("ADMIN") ? (
                <Link
                  href="/admin"
                  className={`hidden h-10 items-center rounded-lg px-3 text-sm font-bold sm:inline-flex ${
                    pathname.startsWith("/admin") ? "bg-ink-strong text-white" : "bg-surface-mid text-ink"
                  }`}
                >
                  Admin
                </Link>
              ) : null}
              {roles.some((role) => ["PROPERTY_OWNER", "REAL_ESTATE_AGENT", "ADMIN"].includes(role)) ? (
                <Link
                  href="/agent"
                  className={`hidden h-10 items-center rounded-lg px-3 text-sm font-bold sm:inline-flex ${
                    pathname.startsWith("/agent") ? "bg-ink-strong text-white" : "bg-surface-mid text-ink"
                  }`}
                >
                  Agent
                </Link>
              ) : null}
              <Link href="/profile" className="rounded-full bg-ink-strong px-3 py-1 text-xs font-bold text-white">
                {displayName}
              </Link>
              <button type="button" onClick={() => void logout()} className="hidden text-sm font-bold text-ink sm:inline">
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                href={loginHref("/list")}
                className="hidden h-10 items-center rounded-lg bg-amber px-3 text-sm font-bold text-white sm:inline-flex"
              >
                + List your property
              </Link>
              <Link href={signInHref} className="text-sm font-bold text-ink">
                Sign in
              </Link>
            </>
          )}
          <button
            type="button"
            className="inline-flex h-10 items-center rounded-lg border border-line px-3 text-sm font-bold lg:hidden"
            aria-expanded={open ? "true" : "false"}
            aria-controls="mobile-nav"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>
      </div>
      <nav
        id="mobile-nav"
        className={`grid gap-1 border-t border-line bg-white px-4 py-3 lg:hidden ${open ? "" : "hidden"}`}
        aria-label="Mobile"
        hidden={!open}
      >
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="rounded-lg px-2 py-2 text-sm font-bold" onClick={() => setOpen(false)}>
            {link.label}
          </Link>
        ))}
        {signedIn ? (
          <button type="button" className="rounded-lg px-2 py-2 text-left text-sm font-bold text-amber" onClick={() => void logout()}>
            Sign out
          </button>
        ) : (
          <Link href={signInHref} className="rounded-lg px-2 py-2 text-sm font-bold text-amber" onClick={() => setOpen(false)}>
            Sign in
          </Link>
        )}
        <Link
          href={signedIn ? "/list" : loginHref("/list")}
          className="rounded-lg bg-amber px-2 py-2 text-center text-sm font-bold text-white"
          onClick={() => setOpen(false)}
        >
          List your property
        </Link>
      </nav>
    </header>
  );
}
