import Link from "next/link";

type LogoProps = {
  inverted?: boolean;
};

export function Logo({ inverted = false }: LogoProps) {
  return (
    <Link href="/" className="flex items-center gap-2">
      <span
        className={
          inverted
            ? "grid h-9 w-9 place-items-center rounded-lg bg-amber-bright text-sm font-extrabold text-ink-strong"
            : "grid h-9 w-9 place-items-center rounded-lg bg-ink-strong text-sm font-extrabold text-white"
        }
        aria-hidden="true"
      >
        PF
      </span>
      <span className="leading-tight">
        <span className={inverted ? "block text-sm font-extrabold tracking-tight text-white" : "block text-sm font-extrabold tracking-tight text-ink"}>
          PropertyFinder
        </span>
        <span className={inverted ? "block text-[10px] font-bold tracking-[0.14em] text-amber-soft" : "block text-[10px] font-bold tracking-[0.14em] text-amber"}>
          PHILIPPINES
        </span>
      </span>
    </Link>
  );
}
