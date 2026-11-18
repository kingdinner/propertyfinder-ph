# DATABASE_DESIGN.md — PropertyFinder PH

**Phase 0 — proposed target model after approval.** Reflects as-built tables plus required deltas.

## Money and units

- Prices/deposits: integer **centavos**.
- Areas: `numeric` **sqm** only in MVP.
- Timestamps: `timestamptz` (UTC). Display Asia/Manila in app.

## Core identity (as-built, keep)

`users`, `user_roles`, `broker_profiles`, `consent_records`, `sessions`, `audit_logs`, tokens.

## Listings (delta)

### Enums

```text
moderation_status:
  draft | pending_review | needs_revision | approved | rejected | archived

availability_status:
  available | reserved | sold | rented | unavailable

listing_category:  # expanded
  house_lot | condo | townhouse | lot | agricultural | apartment | commercial | warehouse

land_classification:  # agricultural
  irrigated | non_irrigated | orchard | mixed | other | unspecified
```

### `listings` columns (add/replace)

| Column | Notes |
| --- | --- |
| `moderation_status` | Replaces single public `status` semantics |
| `availability_status` | Default `available` on create |
| `availability_updated_at` | |
| `expires_at` | Null while draft; set on approve/renew |
| `renewed_at` | |
| `last_material_change_at` | |
| `requires_reapproval` | boolean |
| `security_deposit_php_centavos` | rent |
| `advance_payment_months` | rent |
| `land_classification` | agricultural |
| `fingerprint` | text/hash for duplicate MVP |
| Keep existing | title, description, specs, location, lat/lng, financing child table, media, documents, status events |

**Migration strategy:** map as-built `published` → `approved`; other statuses 1:1 rename where possible; set `availability_status = available` for existing approved rows.

### History

Keep `listing_status_events`; extend to record **both** moderation and availability changes (`event_domain`: moderation | availability | system).

### Locations (new)

`ph_provinces(code, name)`, `ph_cities(province_code, code, name)`, `ph_barangays(city_code, code, name)` + indexes for `ILIKE` autocomplete.

### Media (as-built +)

`listing_media`: storage_key, mime, sort_order, is_cover, deleted_at nullable. No binary in DB.

### Inquiries (delta)

Add: `follow_up_at`, unique partial index or `idempotency_key`, table `inquiry_internal_notes (inquiry_id, author_user_id, body, created_at)`.

### Appointments (as-built +)

Keep overlap rule. Optional `host_availability_windows (host_user_id, starts_at, ends_at)`.

### Notifications / reports (as-built)

Keep `notifications`, `listing_reports`.

## Indexes (required)

- `(moderation_status, availability_status, expires_at)`
- `(moderation_status, transaction, city)`
- `(price_php_centavos)`, `(bedrooms)`, `(published_at` / `approved_at)`
- `(lat, lng)` or PostGIS GIST when enabled
- `favorites(user_id)`, `inquiries(assignee_user_id, status)`, `appointments(host_user_id, status, starts_at)`
- `listings(fingerprint)`, location name trigram/ILIKE indexes as needed

## Explicit non-storage

- No image/PDF BYTEA in PostgreSQL.
- No commission, escrow, mortgage tables in MVP.
