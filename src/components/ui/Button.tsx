import type { ButtonHTMLAttributes } from "react";

const variants = {
  primary: "bg-ink-strong text-white hover:bg-ink",
  amber: "bg-amber text-white hover:bg-[#6e3900]",
  ghost: "bg-transparent text-ink hover:bg-surface-mid",
  outline: "border border-line bg-white text-ink hover:bg-surface-low",
} as const;

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants }) {
  return (
    <button
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
