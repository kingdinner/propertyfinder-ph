# TEST_CASES.md — PropertyFinder PH

Phase 0 catalog. Implement/expand automated coverage in Phases 7–12 after approval.

## Legend

P positive · N negative · B boundary · I integration · E e2e

## Roles and permissions

| ID | Case | Type |
| --- | --- | --- |
| RBAC-01 | Customer denied admin moderation | N |
| RBAC-02 | Owner cannot edit another owner’s listing | N |
| RBAC-03 | Agent can edit assigned listing only | P/N |
| RBAC-04 | Agent/owner cannot approve own listing | N |
| RBAC-05 | Suspended user cannot submit/renew/set AVAILABLE | N |
| RBAC-06 | Public search payload omits customer PII | P |

## Listing moderation transitions

| ID | Case | Type |
| --- | --- | --- |
| MOD-01 | DRAFT → PENDING_REVIEW on valid submit | P |
| MOD-02 | PENDING_REVIEW → APPROVED | P |
| MOD-03 | PENDING_REVIEW → REJECTED requires reason | B |
| MOD-04 | PENDING_REVIEW → NEEDS_REVISION requires reason | B |
| MOD-05 | NEEDS_REVISION / REJECTED → resubmit PENDING_REVIEW | P |
| MOD-06 | Illegal transition APPROVED → DRAFT | N |
| MOD-07 | Material change on APPROVED → PENDING_REVIEW | P |
| MOD-08 | History events written for each transition | I |

## Availability

| ID | Case | Type |
| --- | --- | --- |
| AVAIL-01 | APPROVED+RENTED excluded from available search | P |
| AVAIL-02 | AVAILABLE→SOLD removes from search | P |
| AVAIL-03 | Availability update does not change moderation | P |
| AVAIL-04 | Appointment blocked when UNAVAILABLE | N |

## Expiration

| ID | Case | Type |
| --- | --- | --- |
| EXP-01 | Expired APPROVED+AVAILABLE excluded from search | P |
| EXP-02 | Renew extends expires_at and restores searchability | P |

## Categories and finance

| ID | Case | Type |
| --- | --- | --- |
| CAT-01 | Vacant lot submit without bedrooms succeeds | P |
| CAT-02 | Agricultural requires lot_area + land_classification | N/P |
| CAT-03 | Condo requires floor_area | N/P |
| CAT-04 | Warehouse/commercial specs validated | P |
| FIN-01 | Sale price 0 rejected | B |
| FIN-02 | Rent price 0 rejected | B |
| FIN-03 | Search minPrice > maxPrice rejected | N |
| FIN-04 | Negative security deposit rejected | N |
| FIN-05 | Invalid advance months rejected | N |

## Search

| ID | Case | Type |
| --- | --- | --- |
| SRCH-01 | Two dimensions AND | P |
| SRCH-02 | Multi category OR | P |
| SRCH-03 | Unpublished/unavailable/archived/expired excluded | P |
| SRCH-04 | Buy→Rent clears incompatible filters | P |
| SRCH-05 | Pagination stable totals | B |
| SRCH-06 | Empty results UX | P |
| SRCH-07 | Autocomplete partial match | P |
| SRCH-08 | Map/list same IDs | I |

## Inquiries

| ID | Case | Type |
| --- | --- | --- |
| INQ-01 | Create assigns broker else owner | P |
| INQ-02 | Duplicate submit returns same inquiry | P |
| INQ-03 | Unauthorized cannot read inquiry | N |
| INQ-04 | Internal notes hidden from customer API | N |
| INQ-05 | Notification on create | I |

## Appointments

| ID | Case | Type |
| --- | --- | --- |
| APT-01 | Confirm success | P |
| APT-02 | Concurrent confirm → one 409 | I |
| APT-03 | Decline with reason | P |
| APT-04 | Reschedule → confirm applies new Manila slot | P |
| APT-05 | Cancel preserves history | P |
| APT-06 | Complete terminal | P |
| APT-07 | Create on SOLD listing rejected | N |

## Media

| ID | Case | Type |
| --- | --- | --- |
| MED-01 | Reject non-image MIME | N |
| MED-02 | Reject oversize file | B |
| MED-03 | Reorder + set cover | P |
| MED-04 | Delete removes from gallery | P |

## Notifications

| ID | Case | Type |
| --- | --- | --- |
| NTF-01 | Listing submitted/approved/rejected/expired events | I |
| NTF-02 | Appointment lifecycle events | I |

## E2E journeys

| ID | Case | Type |
| --- | --- | --- |
| E2E-01 | Owner lists → admin approves → appears in search when AVAILABLE | E |
| E2E-02 | Customer inquire → viewing → confirm → complete | E |
| E2E-03 | Approved listing rented → disappears from available search | E |
| E2E-04 | Material edit → reapproval → search again | E |
