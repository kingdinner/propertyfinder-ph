# PROPERTY_LIFECYCLE.md — PropertyFinder PH

## Separation of concerns

```
moderation_status     availability_status
─────────────────     ───────────────────
DRAFT                 AVAILABLE (default draft intent)
PENDING_REVIEW        RESERVED
NEEDS_REVISION        SOLD
APPROVED              RENTED
REJECTED              UNAVAILABLE
ARCHIVED
```

Example valid pair: **APPROVED + RENTED** (visible to owner/agent; **not** in available search).

## Public availability predicate

```
moderation_status = 'approved'
AND availability_status = 'available'
AND (expires_at IS NULL OR expires_at > now())
AND moderation_status <> 'archived'  -- archived never searchable
```

## State machines

### Moderation

See BUSINESS_RULES BR-2. History row on every transition with actor, from, to, note.

### Availability

Owner/assigned agent/admin may move freely among availability values except:

- Suspended users cannot set AVAILABLE.
- System may set UNAVAILABLE on expire (optional policy); MVP: expire hides from search without forcing UNAVAILABLE, but UI shows “Expired”.

## Expiration / renewal

1. On APPROVED: set `expires_at = now() + listing_ttl`.
2. Renew: `expires_at = now() + listing_ttl`, `renewed_at = now()`, history event `renewed`.
3. Expired + APPROVED + AVAILABLE → excluded from search until renew.

## Material change → reapproval

If APPROVED and a material field changes → `PENDING_REVIEW`, `requires_reapproval = true`, history note. Availability unchanged. Search exclusion until APPROVED again.

## Rejection / resubmission

Reject requires reason. Lister edits and resubmits → PENDING_REVIEW. Correction path uses NEEDS_REVISION.

## Duplicate detection

On create/submit compute fingerprint; warn or block exact owner duplicates (MVP).

## Listing history

Append-only events: moderation, availability, renew, expire, media major changes (optional), admin decisions.

## Admin disclaimer

Approval means marketplace publication eligibility only — **not** legal ownership or clean-title verification.
