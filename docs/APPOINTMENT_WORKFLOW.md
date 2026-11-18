# APPOINTMENT_WORKFLOW.md — PropertyFinder PH

## Statuses

`requested | confirmed | reschedule_requested | cancelled | completed | declined`

(`declined` = host rejection)

## Create request

1. Actor: customer or assignee on an open inquiry.
2. Listing must be `APPROVED` and `AVAILABLE` (MVP hard rule).
3. `starts_at` / `ends_at` stored UTC; UI collects Asia/Manila wall time.
4. Host = inquiry assignee.
5. Optional: proposed slot must intersect host availability windows when windows exist.

## Transitions

| From | To | Who |
| --- | --- | --- |
| requested | confirmed | Host |
| requested | declined | Host (+ reason) |
| requested | cancelled | Customer or host (+ reason) |
| confirmed | reschedule_requested | Either party |
| confirmed | cancelled | Either party |
| confirmed | completed | Host |
| reschedule_requested | confirmed | Host (applies proposed times) |
| reschedule_requested | declined / cancelled | Host / either |

Terminal: cancelled, completed, declined.

## Conflict rule

No two **confirmed** appointments may overlap for the **same listing_id and host_user_id**.

Implementation: transaction + `pg_advisory_xact_lock(listing, host)` + overlap query → `409` on conflict.

## Unavailable property

Confirm and create must re-check APPROVED+AVAILABLE inside the transaction.

## History

Every transition writes `appointment_status_events` and AuditLog; notify counterparty.

## Notifications

Viewing request; confirmation; rejection (declined); reschedule; cancellation.
