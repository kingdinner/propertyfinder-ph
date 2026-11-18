import { z } from "zod";
import { parseManilaDateTimeInput, defaultAppointmentEnd } from "@/lib/time/manila";

export const createInquirySchema = z.object({
  listingId: z.string().uuid(),
  message: z.string().trim().min(10).max(4000),
  contactName: z.string().trim().min(2).max(120),
  contactPhone: z.string().trim().max(32).optional(),
  source: z.string().trim().max(80).default("listing_detail"),
});

export const replyInquirySchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

export const updateInquiryStatusSchema = z.object({
  status: z.enum([
    "new",
    "contacted",
    "qualified",
    "viewing_scheduled",
    "converted",
    "closed",
    "lost",
  ]),
  note: z.string().trim().max(1000).optional(),
});

const dateTimeField = z.string().trim().min(1).transform((value, ctx) => {
  try {
    return parseManilaDateTimeInput(value);
  } catch (error) {
    ctx.addIssue({
      code: "custom",
      message: error instanceof Error ? error.message : "Invalid date/time",
    });
    return z.NEVER;
  }
});

export const createAppointmentSchema = z
  .object({
    inquiryId: z.string().uuid(),
    startsAt: dateTimeField,
    endsAt: z.string().trim().optional(),
    contactPhone: z.string().trim().max(32).optional(),
    note: z.string().trim().max(1000).optional(),
  })
  .transform((data) => {
    const endsAt = data.endsAt ? parseManilaDateTimeInput(data.endsAt) : defaultAppointmentEnd(data.startsAt);
    return { ...data, endsAt };
  })
  .superRefine((data, ctx) => {
    if (data.endsAt <= data.startsAt) {
      ctx.addIssue({ code: "custom", message: "endsAt must be after startsAt", path: ["endsAt"] });
    }
    if (data.startsAt.getTime() < Date.now() - 60_000) {
      ctx.addIssue({ code: "custom", message: "startsAt must be in the future", path: ["startsAt"] });
    }
  });

export const appointmentDecisionSchema = z.object({
  action: z.enum(["confirm", "decline", "cancel", "complete", "request_reschedule"]),
  note: z.string().trim().max(1000).optional(),
  startsAt: z.string().trim().optional(),
  endsAt: z.string().trim().optional(),
}).superRefine((data, ctx) => {
  if (data.action === "request_reschedule" && !data.startsAt) {
    ctx.addIssue({ code: "custom", message: "Proposed startsAt is required", path: ["startsAt"] });
  }
  if ((data.action === "decline" || data.action === "cancel") && !data.note?.trim()) {
    ctx.addIssue({ code: "custom", message: "A reason is required", path: ["note"] });
  }
});
