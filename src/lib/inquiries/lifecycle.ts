import type { InquiryStatus, AppointmentStatus } from "@/db/schema";

export class InquiryLifecycleError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = "InquiryLifecycleError";
  }
}

export class AppointmentLifecycleError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "AppointmentLifecycleError";
    this.status = status;
  }
}

const INQUIRY_ALLOWED: Record<InquiryStatus, readonly InquiryStatus[]> = {
  new: ["contacted", "qualified", "viewing_scheduled", "closed", "lost"],
  contacted: ["qualified", "viewing_scheduled", "closed", "lost"],
  qualified: ["viewing_scheduled", "converted", "closed", "lost"],
  viewing_scheduled: ["converted", "closed", "lost", "qualified"],
  converted: ["closed"],
  closed: [],
  lost: [],
};

const APPOINTMENT_ALLOWED: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  requested: ["confirmed", "declined", "cancelled"],
  confirmed: ["reschedule_requested", "cancelled", "completed"],
  reschedule_requested: ["confirmed", "cancelled", "declined"],
  cancelled: [],
  completed: [],
  declined: [],
};

export function assertInquiryTransition(from: InquiryStatus, to: InquiryStatus) {
  if (from === to) return;
  if (!INQUIRY_ALLOWED[from].includes(to)) {
    throw new InquiryLifecycleError(`Cannot move inquiry from ${from} to ${to}`);
  }
}

export function assertAppointmentTransition(from: AppointmentStatus, to: AppointmentStatus) {
  if (from === to) return;
  if (!APPOINTMENT_ALLOWED[from].includes(to)) {
    throw new AppointmentLifecycleError(`Cannot move appointment from ${from} to ${to}`);
  }
}

export function inquiryTerminal(status: InquiryStatus) {
  return status === "closed" || status === "lost" || status === "converted";
}
