import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-surface-low">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-muted">
            A Philippine property marketplace for discovery and listing management. Sample figures on these screens are demo data.
          </p>
        </div>
        <div>
          <h2 className="text-xs font-extrabold tracking-wide text-ink">Browse</h2>
          <ul className="mt-3 grid gap-2 text-sm text-muted">
            <li><Link href="/search?transaction=sale">Buy</Link></li>
            <li><Link href="/search?transaction=rent">Rent</Link></li>
            <li><Link href="/search?category=commercial">Commercial</Link></li>
            <li><Link href="/search?category=lot">Land</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="text-xs font-extrabold tracking-wide text-ink">Portals</h2>
          <ul className="mt-3 grid gap-2 text-sm text-muted">
            <li><Link href="/dashboard">Saved properties</Link></li>
            <li><Link href="/list">List a property</Link></li>
            <li><Link href="/agent">Owner and agent inquiries</Link></li>
            <li><Link href="/admin">Listing review</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="text-xs font-extrabold tracking-wide text-ink">Places</h2>
          <ul className="mt-3 grid gap-2 text-sm text-muted">
            <li>Makati</li>
            <li>Bonifacio Global City</li>
            <li>Lipa City</li>
            <li>Cebu IT Park</li>
          </ul>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 pb-8 lg:px-6">
        <p className="rounded-xl bg-white px-4 py-3 text-sm text-muted">
          A platform listing review is not proof of legal ownership or a clean title. License numbers shown here are sample profile fields.
        </p>
        <p className="mt-4 text-xs text-faint">PropertyFinder PH · sample interface · Terms · Privacy</p>
      </div>
    </footer>
  );
}
