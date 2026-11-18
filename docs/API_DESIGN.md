# API_DESIGN.md — PropertyFinder PH

Base: `/api/v1`. JSON `{ ok, data | error }`. Auth via session cookie. Zod validation on all mutating routes.

## Auth / profiles (as-built)

Unchanged contracts; add publish/submit guards for suspended users.

## Listings

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/listings` | Create DRAFT |
| PATCH | `/listings/:id` | Edit if owned/assigned; material change may force PENDING_REVIEW |
| POST | `/listings/:id/submit` | → PENDING_REVIEW |
| POST | `/listings/:id/resubmit` | From NEEDS_REVISION / REJECTED |
| POST | `/listings/:id/archive` | → ARCHIVED |
| POST | `/listings/:id/renew` | Extends expires_at |
| PATCH | `/listings/:id/availability` | Independent availability update |
| POST | `/listings/duplicate-check` | Fingerprint preview |
| GET | `/listings/:id/history` | Owner/agent/admin |
| GET | `/public/listings/:id` | APPROVED only for public; availability shown |

Admin moderation (as-built paths retained):

| Method | Path |
| --- | --- |
| GET | `/admin/moderation` |
| POST | `/admin/moderation/:id/decide` | approve \| request_changes \| reject (+ reason) |

## Media

| Method | Path |
| --- | --- |
| POST | `/listings/:id/media` | multipart; type/size checks |
| PATCH | `/listings/:id/media/reorder` | ordered ids |
| PATCH | `/listings/:id/media/:mediaId` | set cover |
| DELETE | `/listings/:id/media/:mediaId` | soft/hard delete |

Progress is client-side XHR/fetch reporting; failed uploads retry same endpoint.

## Search / locations

| Method | Path |
| --- | --- |
| GET | `/search` | AND across facets; OR within multi-select; APPROVED+AVAILABLE+not expired |
| GET | `/locations/autocomplete?q=&level=` | province/city/barangay |

Query params: `transaction`, `category` (multi), `province`, `city`, `barangay`, `q`, price/beds/baths/areas/parking/furnishing/availability filters as applicable, `sort`, `page`, `pageSize`, bbox, multi values repeated or comma-separated (document one convention and stick to it).

## Favorites / inquiries / appointments / notifications / reports / dashboards

As-built modules remain; add:

- Inquiry: `followUpAt`, internal notes routes (`POST /inquiries/:id/notes` assignee-only).
- Inquiry create: idempotency key header or body.
- Appointment create/confirm: reject if listing not APPROVED+AVAILABLE.
- Notification list unchanged; expand event types server-side.

## Error codes (common)

`401 unauthorized`, `403 forbidden`, `400 validation_error`, `404 not_found`, `409 conflict` (appointments, duplicates), `429` optional for spam.
