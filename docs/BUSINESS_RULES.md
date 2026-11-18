# BUSINESS_RULES.md — PropertyFinder PH

**Phase 0 — awaiting approval.** Rules are mandatory for architecture; implementation waits for approval.

## BR-1 Dual lifecycle

1. Moderation status and availability status are independent fields.
2. A listing may be `APPROVED` and `RENTED` simultaneously.
3. Public **available search** includes only: `moderation_status = APPROVED` AND `availability_status = AVAILABLE` AND not archived AND not expired (`expires_at` null or `> now()`).
4. Detail pages for non-searchable listings return 404 to unauthorized viewers (owners/agents/admins may still open via private routes).

## BR-2 Moderation statuses

Allowed: `DRAFT`, `PENDING_REVIEW`, `NEEDS_REVISION`, `APPROVED`, `REJECTED`, `ARCHIVED`.

| From | To | Actor |
| --- | --- | --- |
| DRAFT | PENDING_REVIEW | Owner/agent (submit) |
| DRAFT | ARCHIVED | Owner/agent |
| PENDING_REVIEW | APPROVED | Admin |
| PENDING_REVIEW | REJECTED | Admin (+ reason required) |
| PENDING_REVIEW | NEEDS_REVISION | Admin (+ reason required) |
| PENDING_REVIEW | ARCHIVED | Owner/agent or admin |
| NEEDS_REVISION | PENDING_REVIEW | Owner/agent (resubmit) |
| NEEDS_REVISION | DRAFT / ARCHIVED | Owner/agent |
| REJECTED | PENDING_REVIEW | Owner/agent (resubmit with changes) |
| REJECTED | ARCHIVED | Owner/agent |
| APPROVED | PENDING_REVIEW | System/owner after **material change** |
| APPROVED | ARCHIVED | Owner/agent/admin |
| Any non-terminal | ARCHIVED | Per matrix above |

Rejection and correction always store a reason. All transitions append listing history.

## BR-3 Availability statuses

`AVAILABLE | RESERVED | SOLD | RENTED | UNAVAILABLE`

1. Only owner, assigned agent, or admin may change availability.
2. Availability changes do not by themselves change moderation.
3. Setting SOLD/RENTED/UNAVAILABLE removes the listing from available search immediately if previously AVAILABLE.
4. Appointments cannot be confirmed for properties that are not AVAILABLE (and not APPROVED).

## BR-4 Expiration and renewal

1. Approved listings receive `expires_at` (configurable default, e.g. 60 days from approval/renewal).
2. Expired listings drop from available search even if APPROVED + AVAILABLE.
3. Owner/agent may renew if account is active and not suspended → extends `expires_at`, writes history.
4. Renewal of non-material fields does not require reapproval; material changes do (BR-5).

## BR-5 Material changes and reapproval

Material fields (MVP): price, transaction type, category, location (province/city/barangay), floor/lot area, bedrooms (if applicable), title declaration, primary photos set replacement.

On material save while APPROVED: set `requires_reapproval`, move moderation to `PENDING_REVIEW`, remove from available search until reapproved. Availability preserved.

## BR-6 Duplicate detection (MVP)

Fingerprint = normalized (transaction, category, province, city, barangay, street/subdivision, rounded areas, price band). Soft warning on create/submit; hard block optional for exact fingerprint within same owner. Advanced image/ML detection deferred.

## BR-7 Category validation

| Category | Required (submit) | Forbidden / N/A |
| --- | --- | --- |
| Vacant lot | lot_area | bedrooms not required |
| Agricultural land | lot_area, land_classification | bedrooms not required |
| Condo | floor_area, beds (≥0 studio allowed) | lot_area N/A |
| House & lot / townhouse / apartment | floor_area, lot_area (house/townhouse), beds | — |
| Commercial / warehouse | floor_area (and/or lot as applicable), commercial specs | residential-only fields optional |

Transaction:

- Sale: positive asking price; financing options optional tags.
- Rent: positive monthly rent; security_deposit ≥ 0; advance_payment_months ≥ 0 and within configured max.

Areas use sqm only in MVP. Min price ≤ max price in search filters.

Validation on **frontend and backend**.

## BR-8 Search

1. Cross-filter groups: AND.
2. Multi-select values inside one facet: OR.
3. Exclude unpublished (not APPROVED), unavailable, archived, expired.
4. Buy→Rent and Rent→Buy resets incompatible filters and reloads category/filter sets.
5. Server-side filter, sort, pagination; URL persistence; clear one / clear all; empty state.
6. Map and list use the same result query.

## BR-9 Permissions

See RBAC.md. Backend enforces all rules. Suspended users cannot submit, renew, or publish/set AVAILABLE.

## BR-10 Media

Multiple images; allowlist MIME; max size; order; cover; delete; preview; progress; retry. Store object keys only — never BYTEA in PostgreSQL.

## BR-11 Inquiries

Ownership: customer + assignee (broker else owner). Duplicate protection within idempotency window. Status + history + optional follow-up date + internal notes (assignee/admin only). Notify on create/reply/status.

## BR-12 Appointments

Request → confirm/reject(decline)/reschedule/cancel/complete. No overlapping confirmed slots for same listing **and** host. Block if property not APPROVED+AVAILABLE. Asia/Manila for display; UTC timestamptz storage. History preserved. Confirm under transaction + lock.

## BR-13 Notifications

In-app first. Events: new inquiry; viewing request; appointment confirm/reject/reschedule/cancel; listing submitted/approved/rejected/expired. Email adapter pluggable.

## BR-14 Admin

Queue, review, approve, reject+reason, request correction, archive, suspend users, review reports, listing history, audit admin actions. Approval ≠ legal verification.

## BR-15 Quality and errors

Accurate counts; indexes; pagination; completeness indicators; labeled sample data only. Every workflow: loading, success, validation errors, API errors, permission errors, empty states, network failure, retry where appropriate. No silent failures.
