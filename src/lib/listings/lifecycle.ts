import type { ListingStatus } from "@/db/schema";

export type ListingTransition =
  | "save_draft"
  | "submit"
  | "resubmit"
  | "approve"
  | "request_changes"
  | "reject"
  | "archive";

const ALLOWED: Record<ListingTransition, readonly ListingStatus[]> = {
  save_draft: ["draft", "needs_revision", "rejected"],
  submit: ["draft"],
  resubmit: ["needs_revision", "rejected"],
  approve: ["pending_review"],
  request_changes: ["pending_review"],
  reject: ["pending_review"],
  archive: ["draft", "needs_revision", "rejected", "published", "pending_review"],
};

const NEXT: Record<ListingTransition, ListingStatus> = {
  save_draft: "draft", // overridden to keep needs_revision/rejected until explicit save keeps editable status
  submit: "pending_review",
  resubmit: "pending_review",
  approve: "published",
  request_changes: "needs_revision",
  reject: "rejected",
  archive: "archived",
};

export class ListingLifecycleError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = "ListingLifecycleError";
  }
}

export function assertTransition(from: ListingStatus, transition: ListingTransition): ListingStatus {
  if (!ALLOWED[transition].includes(from)) {
    throw new ListingLifecycleError(`Cannot ${transition} a listing in status ${from}`);
  }
  if (transition === "save_draft") {
    // Editable statuses stay themselves while drafts remain draft.
    if (from === "draft" || from === "needs_revision" || from === "rejected") return from;
  }
  return NEXT[transition];
}

export function isEditableStatus(status: ListingStatus): boolean {
  return status === "draft" || status === "needs_revision" || status === "rejected";
}

export function allTransitions(): ListingTransition[] {
  return Object.keys(ALLOWED) as ListingTransition[];
}

export function allowedFrom(status: ListingStatus): ListingTransition[] {
  return allTransitions().filter((transition) => ALLOWED[transition].includes(status));
}
