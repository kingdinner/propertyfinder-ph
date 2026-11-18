# INQUIRY_WORKFLOW.md — PropertyFinder PH

## Create

1. Customer authenticated + email verified.
2. Listing must be publicly inquireable: APPROVED (availability may still allow inquiry when RESERVED — **MVP policy: allow inquiry on APPROVED && availability ∈ {AVAILABLE, RESERVED}**; block SOLD/RENTED/UNAVAILABLE).
3. Assignee = `broker_user_id ?? owner_user_id`.
4. Cannot inquire on own listing.
5. **Duplicate protection:** same customer + listing + identical message hash within N minutes (or Idempotency-Key) → return existing inquiry (200) without second notification storm.
6. Persist message; open history; notify assignee (in-app; email optional adapter).

## Ownership and privacy

- Customer sees own inquiries only.
- Assignee (and admin) see assigned inquiries.
- Internal notes: assignee/admin only — never in customer payloads.
- Customer PII not exposed on public listing endpoints.

## Status (as-built aligned)

`new → contacted → qualified → viewing_scheduled → converted | closed | lost`

Assignee updates status; customer cannot arbitrarily set status. Reply by assignee from `new` may auto-advance to `contacted`.

## Follow-up

`follow_up_at` settable by assignee; shown in agent dashboard; Manila display.

## History

Status events + messages + internal notes timestamps. AuditLog on create/status.

## Notifications

Triggers: new inquiry; reply (both sides); status change (customer).
