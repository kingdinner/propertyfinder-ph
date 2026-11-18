import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthenticationError, AuthorizationError } from "@/lib/auth/rbac";
import { FavoriteError } from "@/lib/favorites/service";
import {
  AppointmentLifecycleError,
  InquiryLifecycleError,
} from "@/lib/inquiries/lifecycle";
import { ListingLifecycleError } from "@/lib/listings/lifecycle";
import { ReportError } from "@/lib/reports/service";

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, { status: 200, ...init });
}

export function jsonCreated<T>(data: T) {
  return NextResponse.json({ ok: true, data }, { status: 201 });
}

export function jsonError(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json({ ok: false, error: { code, message, details } }, { status });
}

export function handleRouteError(error: unknown) {
  if (error instanceof AuthenticationError) {
    return jsonError(401, "unauthorized", error.message);
  }
  if (error instanceof AuthorizationError) {
    return jsonError(403, "forbidden", error.message);
  }
  if (error instanceof ZodError) {
    return jsonError(400, "validation_error", "Invalid request", error.flatten());
  }
  if (error instanceof ListingLifecycleError) {
    return jsonError(400, "listing_lifecycle_error", error.message);
  }
  if (error instanceof FavoriteError) {
    return jsonError(error.status, "favorite_error", error.message);
  }
  if (error instanceof InquiryLifecycleError) {
    return jsonError(error.status, "inquiry_lifecycle_error", error.message);
  }
  if (error instanceof AppointmentLifecycleError) {
    return jsonError(error.status, "appointment_lifecycle_error", error.message);
  }
  if (error instanceof ReportError) {
    return jsonError(error.status, "report_error", error.message);
  }
  if (error instanceof Error && error.message === "EMAIL_TAKEN") {
    return jsonError(409, "email_taken", "An account with this email already exists");
  }
  console.error(error);
  return jsonError(500, "internal_error", "Something went wrong");
}

export async function readJson<T>(request: Request, schema: { parse: (value: unknown) => T }): Promise<T> {
  const body = await request.json().catch(() => {
    throw new ZodError([
      {
        code: "custom",
        message: "Request body must be JSON",
        path: [],
      },
    ]);
  });
  return schema.parse(body);
}
