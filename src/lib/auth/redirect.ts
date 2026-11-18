import type { Role } from "@/lib/auth/rbac";

/** Only allow same-origin relative paths as post-login destinations. */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard") {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  if (next.startsWith("/login") || next.startsWith("/register") || next.startsWith("/forgot-password") || next.startsWith("/reset-password")) {
    return fallback;
  }
  return next;
}

export function homeForRoles(roles: readonly Role[] | readonly string[]) {
  if (roles.includes("ADMIN")) return "/admin";
  if (roles.includes("REAL_ESTATE_AGENT") || roles.includes("PROPERTY_OWNER")) return "/agent";
  return "/dashboard";
}

export function loginHref(next?: string | null) {
  const path = safeNextPath(next, "");
  return path ? `/login?next=${encodeURIComponent(path)}` : "/login";
}
