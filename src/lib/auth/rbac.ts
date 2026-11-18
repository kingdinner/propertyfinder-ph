import type { UserRole } from "@/db/schema";

export const ROLES = [
  "CUSTOMER",
  "PROPERTY_OWNER",
  "REAL_ESTATE_AGENT",
  "ADMIN",
] as const satisfies readonly UserRole[];

export type Role = (typeof ROLES)[number];

export const PORTAL_ROUTES = {
  "/dashboard": ["CUSTOMER", "PROPERTY_OWNER", "REAL_ESTATE_AGENT", "ADMIN"] as Role[],
  "/profile": ["CUSTOMER", "PROPERTY_OWNER", "REAL_ESTATE_AGENT", "ADMIN"] as Role[],
  "/list": ["PROPERTY_OWNER", "REAL_ESTATE_AGENT", "ADMIN"] as Role[],
  "/agent": ["PROPERTY_OWNER", "REAL_ESTATE_AGENT", "ADMIN"] as Role[],
  "/admin": ["ADMIN"] as Role[],
} as const;

export type Permission =
  | "profile:read_own"
  | "profile:update_own"
  | "portal:customer"
  | "portal:owner"
  | "portal:agent"
  | "portal:admin"
  | "listing:create"
  | "listing:manage_own"
  | "listing:moderate"
  | "favorite:manage"
  | "inquiry:create"
  | "inquiry:manage_own"
  | "inquiry:manage_assigned"
  | "appointment:manage"
  | "report:create"
  | "admin:suspend_user"
  | "admin:review_license"
  | "admin:manage_reports"
  | "admin:view_analytics";

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  CUSTOMER: [
    "profile:read_own",
    "profile:update_own",
    "portal:customer",
    "favorite:manage",
    "inquiry:create",
    "inquiry:manage_own",
    "appointment:manage",
    "report:create",
  ],
  PROPERTY_OWNER: [
    "profile:read_own",
    "profile:update_own",
    "portal:customer",
    "portal:owner",
    "listing:create",
    "listing:manage_own",
    "favorite:manage",
    "inquiry:create",
    "inquiry:manage_own",
    "inquiry:manage_assigned",
    "appointment:manage",
    "report:create",
  ],
  REAL_ESTATE_AGENT: [
    "profile:read_own",
    "profile:update_own",
    "portal:customer",
    "portal:agent",
    "listing:create",
    "listing:manage_own",
    "favorite:manage",
    "inquiry:create",
    "inquiry:manage_own",
    "inquiry:manage_assigned",
    "appointment:manage",
    "report:create",
  ],
  ADMIN: [
    "profile:read_own",
    "profile:update_own",
    "portal:customer",
    "portal:owner",
    "portal:agent",
    "portal:admin",
    "listing:create",
    "listing:manage_own",
    "listing:moderate",
    "favorite:manage",
    "inquiry:create",
    "inquiry:manage_own",
    "inquiry:manage_assigned",
    "appointment:manage",
    "report:create",
    "admin:suspend_user",
    "admin:review_license",
    "admin:manage_reports",
    "admin:view_analytics",
  ],
};

export function hasRole(roles: readonly Role[], required: Role | Role[]): boolean {
  const needed = Array.isArray(required) ? required : [required];
  return needed.some((role) => roles.includes(role));
}

export function hasPermission(roles: readonly Role[], permission: Permission): boolean {
  return roles.some((role) => ROLE_PERMISSIONS[role].includes(permission));
}

export function permissionsFor(roles: readonly Role[]): Permission[] {
  const set = new Set<Permission>();
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role]) {
      set.add(permission);
    }
  }
  return [...set];
}

export function canAccessPath(roles: readonly Role[], pathname: string): boolean {
  const match = Object.entries(PORTAL_ROUTES).find(([route]) => pathname === route || pathname.startsWith(`${route}/`));
  if (!match) return true;
  return hasRole(roles, match[1]);
}

export function assertPermission(roles: readonly Role[], permission: Permission): void {
  if (!hasPermission(roles, permission)) {
    throw new AuthorizationError(`Missing permission: ${permission}`);
  }
}

export function assertRole(roles: readonly Role[], required: Role | Role[]): void {
  if (!hasRole(roles, required)) {
    throw new AuthorizationError("Insufficient role");
  }
}

export class AuthorizationError extends Error {
  readonly status = 403;
  constructor(message = "Forbidden") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export class AuthenticationError extends Error {
  readonly status = 401;
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "AuthenticationError";
  }
}
