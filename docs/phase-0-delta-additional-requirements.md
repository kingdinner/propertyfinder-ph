# PropertyFinder PH — Phase 0 delta assessment

**Status: awaiting approval. No implementation of the additional requirements in this phase.**

Date: 18 Nov 2026  
Scope: Incorporate the mandatory *Additional Functional Requirements and Business Logic* into architecture and planning. Identify gaps against the current codebase (Phases 1–6 already shipped under the prior Phase 0 plan). Do **not** begin a new build phase until this package is reviewed and approved.

Related documents (all new/updated in this Phase 0):

| Document | Path |
| --- | --- |
| PRD | [PRD.md](./PRD.md) |
| User stories | [USER_STORIES.md](./USER_STORIES.md) |
| Business rules | [BUSINESS_RULES.md](./BUSINESS_RULES.md) |
| Database design | [DATABASE_DESIGN.md](./DATABASE_DESIGN.md) |
| API design | [API_DESIGN.md](./API_DESIGN.md) |
| RBAC | [RBAC.md](./RBAC.md) |
| Property lifecycle | [PROPERTY_LIFECYCLE.md](./PROPERTY_LIFECYCLE.md) |
| Search workflow | [SEARCH_WORKFLOW.md](./SEARCH_WORKFLOW.md) |
| Inquiry workflow | [INQUIRY_WORKFLOW.md](./INQUIRY_WORKFLOW.md) |
| Appointment workflow | [APPOINTMENT_WORKFLOW.md](./APPOINTMENT_WORKFLOW.md) |
| Test cases | [TEST_CASES.md](./TEST_CASES.md) |
| Original Phase 0 | [phase-0-assessment.md](./phase-0-assessment.md) |

---

## 1. Current system snapshot (as-built)

The repository is no longer empty. Prior approved phases delivered:

| Area | As-built summary |
| --- | --- |
| Stack | Next.js App Router, TypeScript, Tailwind, Drizzle, PostgreSQL, Zod, session auth |
| Auth / RBAC | Roles CUSTOMER, PROPERTY_OWNER, REAL_ESTATE_AGENT, ADMIN; permission checks on APIs |
| Listings | Single `listings.status`: draft → pending_review → needs_revision \| rejected \| published \| archived |
| Search | Server-side filters on **published** only; URL params; favorites |
| Media | Local filesystem uploads (not Postgres BLOBs); cover + order |
| Inquiries / appointments | Full status machines; Manila display; advisory lock on confirm conflict |
| Notifications | In-app + email log for key inquiry/appointment/moderation events |
| Dashboards | Customer, agent, admin with DB counts, pagination, reports |
| Storage | Local `uploads/`; S3 deferred |

This delta does **not** restart the product. It remaps and extends the as-built model to the new mandatory rules.

---

## 2. Gap analysis — missing business rules

| # | New requirement | As-built gap | Decision |
| --- | --- | --- | --- |
| 1 | Separate **moderation status** from **availability** | Only one status field; no AVAILABLE/RESERVED/SOLD/RENTED/UNAVAILABLE | **MVP gap — must implement** |
| 1 | Moderation enum DRAFT / PENDING_REVIEW / APPROVED / REJECTED / ARCHIVED | Uses `published` and `needs_revision` instead of APPROVED / request-changes as separate moderation label | **Align enums** (map `published`→APPROVED; keep needs_revision as correction request under moderation) |
| 1 | Listing expiration + renewal | No `expires_at` / renew flow | **MVP gap — must implement** |
| 1 | Reapproval after material changes | Edits blocked while pending; published edits not modeled | **MVP gap — must implement** |
| 1 | Duplicate listing detection | None | **MVP gap — basic detection**; fuzzy ML deferred |
| 1 | Availability updates independent of moderation | Missing | **MVP gap — must implement** |
| 2 | Categories: agricultural, apartment, warehouse | Only house_lot, condo, townhouse, lot, commercial | **Extend categories** in MVP |
| 2 | Land classification; security deposit; advance payment | Missing fields | **MVP for rent deposits**; land classification MVP for agricultural |
| 2 | Dual FE/BE validation for all category rules | Partial category rules exist | **Harden and expand** |
| 3 | Multi-select OR within filter; AND across filters | Mostly single-value filters | **Extend search contract** |
| 3 | Location autocomplete + hierarchy | Free-text province/city/barangay | **MVP: hierarchical lookup table + autocomplete API**; full PSA dataset polish later |
| 3 | Exclude unavailable + expired + archived | Excludes non-published only | **Must combine APPROVED + AVAILABLE + not expired** |
| 3 | Buy↔Rent filter reset of incompatible fields | Partial UI reset | **Must complete** |
| 3 | Map/list consistency | Optional map pins from same result set | **Keep; strengthen bbox + same query** |
| 4 | Agents cannot approve own listings | Admin-only moderate; owners don't self-approve today | **Codify explicit rule + tests** |
| 4 | Suspended cannot publish | Suspend blocks login; not explicitly publish path | **Add explicit publish/submit guard** |
| 5 | Upload progress, reorder, delete, failed recovery | Upload + cover; limited reorder/delete/progress | **MVP gap — complete media UX** |
| 5 | Secure object storage | Local disk | **Design for S3**; local OK in dev; production adapter **MVP-ready interface** |
| 6 | Duplicate inquiry protection | None | **MVP gap** |
| 6 | Follow-up date, internal notes | Messages exist; no follow-up / private notes | **MVP gap** |
| 7 | Reject appointment; host availability calendar | Decline exists; no availability windows | **Decline = rejection**; host availability windows **MVP light** (manual) |
| 7 | Block appointments on unavailable properties | Not checked | **MVP gap** |
| 8 | Notification matrix (submit/approve/reject/expire) | Partial inquiry/appointment/moderate emails | **Complete event catalog**; email adapter remains pluggable |
| 9 | Request correction + archive + listing history UI | Exists as needs_revision / archive / status events | **Expose history in admin**; align naming |
| 10 | Completeness score / missing-info indicators | Submit validation only | **MVP: completeness checklist**; no fake market stats |
| 11 | Network retry UX | Partial | **Standardize across workflows** |
| 12–13 | Docs + expanded tests | Partial phase tests | **This Phase 0 package + later test expansion** |

### Deferred (document, do not build now)

- Automated duplicate detection beyond deterministic fingerprints (ML / image hash).
- Full national location GIS dataset sync.
- Email/SMS/push providers beyond the existing email interface.
- Host calendar sync (Google/Outlook).
- Saved-search alert delivery workers.
- Legal ownership verification, LRA/PRC live APIs, mortgage, escrow, commissions, KYC uploads.
- Advanced CRM automation and forecasting.

---

## 3. Data model changes (summary)

See [DATABASE_DESIGN.md](./DATABASE_DESIGN.md) for full DDL intent.

**Breaking conceptual change:** split `listings.status` into:

1. `moderation_status` — DRAFT | PENDING_REVIEW | APPROVED | REJECTED | ARCHIVED (+ keep correction path as `NEEDS_REVISION` or map request-changes without leaving APPROVED incorrectly).
2. `availability_status` — AVAILABLE | RESERVED | SOLD | RENTED | UNAVAILABLE.

Recommended MVP moderation set (explicit):

`DRAFT | PENDING_REVIEW | NEEDS_REVISION | APPROVED | REJECTED | ARCHIVED`

`NEEDS_REVISION` is retained as the “request correction” state (admin outcome), even though the new prompt listed APPROVED/REJECTED only — omitting it would remove an already-shipped and required admin capability. Documented as an allowed extension of the prompt’s moderation list.

New / changed columns and tables:

- `expires_at`, `renewed_at`, `last_material_change_at`, `requires_reapproval`
- `availability_status`, `availability_updated_at`
- Rent: `security_deposit_php_centavos`, `advance_payment_months`
- Category expansion + `land_classification` (agricultural)
- `listing_fingerprints` or unique soft-index for duplicate detection
- `inquiry_follow_ups`, `inquiry_internal_notes` (or columns on inquiries)
- `inquiry_idempotency` / unique constraint for duplicate submission window
- `host_availability_windows` (optional light table)
- Location reference tables: `ph_provinces`, `ph_cities`, `ph_barangays`
- Media: `sort_order`, `is_cover` already exist; add soft-delete / replace metadata as needed

---

## 4. API dependencies

| Dependency | APIs affected |
| --- | --- |
| Dual status | `listings`, `search`, `public/listings`, dashboards, admin moderation |
| Expiration / renew | `listings/:id/renew`, cron or on-read expiry check |
| Material change / reapproval | `PATCH listings` rules when APPROVED |
| Availability update | `PATCH listings/:id/availability` |
| Duplicate check | `POST listings/duplicate-check` (or inline on create/submit) |
| Category validation | listing create/update/submit schemas |
| Search AND/OR + autocomplete | `GET /search`, `GET /locations/autocomplete` |
| Media reorder/delete/progress | `media` routes |
| Inquiry duplicate + notes + follow-up | `inquiries` |
| Appointment unavailable guard | `appointments` |
| Notification catalog | internal `notifications` service events |
| Admin history | `GET listings/:id/history` |

All permission checks remain server-side. UI hiding is not sufficient.

---

## 5. Frontend dependencies

| Surface | Changes |
| --- | --- |
| Listing wizard | Dual status display; category forms for new types; deposit/advance; completeness meter; media manager UX |
| Search | Multi-select chips with OR; Buy/Rent incompatible filter reset; autocomplete; exclude unavailable/expired |
| Listing detail | Availability badge separate from moderation; report; inquiry duplicate messaging |
| Agent dashboard | Availability controls; expiration/renew CTAs; inquiry follow-up/notes |
| Admin | History timeline; dual badges; expiration queue; duplicate flags |
| Shared | Loading / empty / error / retry patterns standardized |

---

## 6. Security implications

| Topic | Rule |
| --- | --- |
| Ownership | Owners manage own listings only; agents only assigned; enforced in services |
| Self-approval | Agents/owners never call moderate endpoints successfully for own listings |
| Suspended users | Cannot submit, renew, or set AVAILABLE |
| PII | Customer phone/email only on authorized inquiry threads; never in public search cards |
| Media | Object keys private by default for documents; public photos via CDN/signed URLs |
| Reports / audit | Admin actions append AuditLog; approvals are not ownership certificates |
| Idempotency | Inquiry duplicate window prevents spam and accidental double posts |

---

## 7. Testing requirements

See [TEST_CASES.md](./TEST_CASES.md). Mandatory coverage themes:

- Every role × forbidden action
- Every moderation transition + every availability transition (including illegal pairs)
- Every category × required/forbidden fields
- Search AND/OR combinations, Buy↔Rent reset, unavailable/expired exclusion
- Invalid financial ranges
- Duplicate inquiry
- Conflicting appointment confirms (concurrency)
- Notification event emission
- Image type/size validation
- Positive / negative / boundary / integration / e2e

---

## 8. Implementation dependencies (order)

```
Approved Phase 0 docs
    → Schema migration (dual status + fields + locations)
        → Lifecycle + validation services
            → Search contract rewrite (APPROVED+AVAILABLE+not expired)
                → Media polish
                    → Inquiry/appointment rule deltas
                        → Notification catalog completion
                            → Dashboard/admin history UX
                                → Expanded automated tests
```

Do **not** start coding until this Phase 0 delta is approved.

---

## 9. Revised roadmap (post-approval)

Prior roadmap Phases 1–6 are treated as **baseline complete**. New work is a **compliance delta**, not a greenfield rebuild.

| Phase | Name | Outcome | Done when |
| --- | --- | --- | --- |
| **0** | **This package** | Rules, model, APIs, RBAC, tests documented; gaps classified MVP vs deferred | **Approved** |
| **7** | Dual lifecycle + schema | Moderation ≠ availability; expiration/renew; history; basic duplicate fingerprint; category/finance fields | Migrations applied; unit tests for transitions |
| **8** | Search compliance | APPROVED+AVAILABLE only; AND/OR filters; autocomplete; Buy/Rent reset; URL persistence | Search QA matrix green |
| **9** | Media + listing quality | Reorder/delete/progress; completeness indicators; secure storage interface | Upload QA green |
| **10** | Inquiry/appointment deltas | Duplicate protection; follow-up; internal notes; unavailable property block; host windows (light) | Workflow tests green |
| **11** | Notifications + admin polish | Full event catalog; listing history UI; expiration queue | Event tests green |
| **12** | Hardening | Indexes, pagination audits, retry UX, e2e role suite | Full TEST_CASES MVP set passing |

Phases after 0 start only after approval. Deferred items stay out of 7–12 unless explicitly pulled in.

---

## 10. Approval checklist

1. Accept dual moderation + availability model (with `NEEDS_REVISION` retained).
2. Accept revised roadmap Phases 7–12 as the next build sequence (baseline already shipped).
3. Accept deferred list (no silent omission — deferred is explicit).
4. Confirm public search predicate: **moderation = APPROVED AND availability = AVAILABLE AND not expired AND not archived**.
5. Confirm admin approval copy remains: **not legal ownership verification**.

**Stop here until approved. No Phase 7 implementation in this turn.**
