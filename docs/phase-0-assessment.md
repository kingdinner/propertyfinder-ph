# PropertyFinder PH — Phase 0 assessment

> **Update (18 Nov 2026):** Additional mandatory functional requirements were received after Phases 1–6 of the original roadmap were already implemented. A **Phase 0 delta** documents gaps, dual lifecycle redesign, deferred items, and a revised post-approval roadmap (Phases 7–12).  
> **Do not implement that delta until approved.** See [phase-0-delta-additional-requirements.md](./phase-0-delta-additional-requirements.md) and the suite of docs linked there (`PRD.md`, `BUSINESS_RULES.md`, `DATABASE_DESIGN.md`, etc.).

Status (original): historically approved for baseline build. Status (delta): **awaiting approval**.

Sources inspected on 18 Nov 2026:

- Repository `/Users/kingrowellvidal/.cursor/Real-Estate` (Git initialized on `master`, no commits, no application files before this phase).
- Design artifact `artifacts/PropertyFinder_PH_Refined_MVP_Design.zip`, extracted to `artifacts/stitch_propertyfinder_ph_platform/`.
- `README_MVP.md` plus the eight retained Stitch screens (`code.html` and `screen.png`).

The PropertyFinder PH Master Prompt was not in the repository. Google Drive search returned `invalid_grant` after authentication, so this plan follows the user request for Phase 0 and the refined MVP design package. Stack choices below are a proposal for approval, not an inherited specification.

## 1. Repository assessment

| Area | Finding |
| --- | --- |
| Application code | None. No `package.json`, lockfile, framework, source tree, tests, or CI. |
| Git | `master` exists. No commits. No remote. |
| Data | No schema, migrations, or seed data. |
| Auth and RBAC | Not implemented. |
| Design input | Refined Stitch package only. HTML is a visual reference (Tailwind via CDN), not the application. |
| Screens retained | Homepage, search with map, property details, auth, customer dashboard, listing wizard, agent CRM, admin moderation. |
| Explicitly out of MVP | Separate rent portal, duplicate mobile apps, lease execution, escrow, mortgage comparison, mandatory KYC, automated title verification, yield analytics, commission automation. |

The HTML still shows institutional claims (live LRA match, PRC sync, bank amortization, commission totals, DHSUD ledger). The README overrides those claims for the MVP: badges must reflect stored status, sample metrics must be labeled demo data, and a listing review is not proof of ownership or clean title.

## 2. Architecture proposal

Monolith for the MVP. One deployable web application owns the UI and the HTTP API. Split services only after moderation, search, and media volumes justify it.

| Layer | Proposal |
| --- | --- |
| Web | Next.js (App Router) + TypeScript + Tailwind. Responsive layouts of the eight screens. No separate mobile codebase. |
| API | Route handlers grouped by module. Request and response contracts validated with Zod. |
| Database | PostgreSQL with PostGIS for pin and bounding-box search. |
| Data access | Drizzle ORM and SQL migrations. |
| Auth | Email and password sessions. Email verification before publishing a listing or sending an inquiry. Google and Apple buttons stay visual until a later phase. |
| Files | S3-compatible object storage. Public photo URLs. Title PDFs are private and served through authorized downloads. |
| Map | MapLibre with stored latitude and longitude. Draw-area and “search as I move” use a bounding box. |
| Email | Provider interface. Development logs messages. Production adapter is a later configuration choice. |
| Background work | None in the first implementation phases. Audit rows are written in the same transaction as the moderation decision. |

Public pages never call an LRA, PRC, BIR, or bank API. “Clean title”, “PRC licensed”, and “verified” are labels of stored records and admin decisions.

Suggested request path:

`Browser → Next.js UI → module route handler → Drizzle → PostgreSQL / object storage`

## 3. Database entity model

Money is integer centavos (`price_php_centavos`) so peso amounts do not use floating point. Areas are numeric square meters. Coordinates are a PostGIS point plus indexed latitude and longitude for simpler filters.

### Identity

- **User** — id, email (unique), password_hash, full_name, phone_e164, email_verified_at, status (`active`, `suspended`), created_at.
- **UserRole** — user_id, role (`customer`, `owner`, `broker`, `admin`). A person may hold more than one role. The header “switch portal” picks the active portal, not a second account.
- **BrokerProfile** — user_id, display_name, agency_name, prc_license_no, dhsud_registration_no, bio, license_review_status (`unreviewed`, `accepted`, `rejected`). License numbers are self-declared until an admin reviews them.
- **ConsentRecord** — user_id, terms_version, privacy_version, accepted_at. Covers the Data Privacy Act consent checkbox. No ID-document upload in MVP.

### Listings

- **Listing** — id, public_code, owner_user_id, broker_user_id nullable, transaction (`sale`, `rent`), category (`house_lot`, `condo`, `townhouse`, `lot`, `commercial`), title, description, construction_status, furnishing, bedrooms, bathrooms, powder_rooms, parking_slots, floor_area_sqm, lot_area_sqm, declared_title_status (`clean_tct_cct`, `mortgaged`, `tax_declaration`, `estate_settlement`, `unspecified`), price_php_centavos, price_negotiable, hoa_dues_php_centavos, rpt_status, province, city, barangay, postal_code, subdivision, street_address, lat, lng, geom, status (`draft`, `pending_review`, `needs_revision`, `rejected`, `published`, `archived`), published_at, created_at, updated_at.
- **ListingFinancingOption** — listing_id, option (`cash`, `bank`, `in_house`, `pagibig`). Optional tags only. No amortization engine.
- **ListingMedia** — listing_id, storage_key, sort_order, is_cover, alt_text.
- **ListingDocument** — listing_id, storage_key, kind (`title`, `tax`, `other`), visibility `admin_only`.
- **ListingStatusEvent** — listing_id, actor_user_id, from_status, to_status, note, created_at.

### Discovery and contact

- **Favorite** — user_id, listing_id, created_at. Unique pair.
- **SavedSearch** — user_id, name, filters jsonb, alert_enabled. Alerts are stored. Delivery is a later phase.
- **Inquiry** — id, listing_id, customer_user_id, assignee_user_id, status (`new`, `contacted`, `qualified`, `viewing`, `closed`, `lost`), message, source, created_at.
- **InquiryMessage** — inquiry_id, sender_user_id, body, created_at.
- **Appointment** — inquiry_id, listing_id, customer_user_id, host_user_id, starts_at, status (`requested`, `confirmed`, `rescheduled`, `cancelled`, `completed`), contact_phone, note.

### Governance

- **ModerationCase** — listing_id, queue_status (`pending`, `needs_revision`, `flagged`, `decided`), assignee_user_id, opened_at.
- **ModerationDecision** — case_id, actor_user_id, outcome (`approve`, `request_changes`, `reject`), note_to_lister, created_at.
- **AuditLog** — actor_user_id, action, entity_type, entity_id, metadata jsonb, created_at.
- **Report** — reporter_user_id nullable, listing_id, reason, status. Admin “flagged” queue. No fraud-scoring model.

Indexes: listing status + transaction + city; price; bedrooms; published_at; GIST on geom; inquiry assignee + status; favorite user_id.

Demo listings and dashboard counts ship behind a seed flag and a visible “sample data” label. They are not production metrics.

## 4. API module plan

Base path `/api/v1`. All mutating routes require a session. Authorization is checked in the module, not only in the UI.

| Module | Responsibilities |
| --- | --- |
| `auth` | Register (role: customer, owner, or broker), login, logout, email verification, current session. |
| `profiles` | Read and update own profile. Broker license fields. Active portal preference. |
| `listings` | Create draft, update own draft or needs-revision listing, submit for review, archive. Public read of `published` only. |
| `media` | Presigned upload for photos. Private upload for documents. Reorder and cover selection. |
| `search` | Public filter: transaction, location text, category, price, beds, furnishing, declared title status, bbox, sort. Paginated. |
| `favorites` | Add, remove, list saved listings for the current customer. |
| `inquiries` | Customer creates an inquiry on a published listing. Lister reads and replies. Status changes limited to the MVP pipeline. |
| `appointments` | Customer requests a viewing. Lister confirms, reschedules, or cancels. |
| `saved-searches` | CRUD for the customer dashboard. No outbound alert worker in MVP. |
| `agent` | Listings and inquiries where the user is owner or broker assignee. Simple status counts. |
| `admin` | Moderation queue, decision, user suspend, broker license review, report list. |
| `audit` | Append-only read for admins. CSV export of moderation decisions. |

Public homepage collections are queries (`featured`, `location group`), not a CMS in phase 1.

## 5. RBAC matrix

`—` none, `R` read, `C` create, `U` update, `D` delete or archive, `M` moderate.

| Capability | Guest | Customer | Owner | Broker | Admin |
| --- | --- | --- | --- | --- | --- |
| Browse published listings and map | R | R | R | R | R |
| Open published listing detail | R | R | R | R | R |
| Register and sign in | C | R | R | R | R |
| Save listing, saved search | — | CUD | CUD | CUD | — |
| Send inquiry, request viewing | — | C | C | C | — |
| Read own inquiries and appointments | — | R | R | R | R |
| Create and edit own listing draft | — | — | CU | CU | — |
| Submit listing for review | — | — | U | U | — |
| Reply and set inquiry status on assigned listings | — | — | U | U | R |
| Confirm or reschedule assigned viewings | — | — | U | U | R |
| Upload listing photos | — | — | CU | CU | R |
| Upload or download title documents | — | — | C | C | R |
| Moderation queue and decision | — | — | — | — | M |
| Suspend user, review broker license | — | — | — | — | M |
| Audit log and moderation CSV | — | — | — | — | R |

Owner and broker see only listings they created or that name them as `broker_user_id`. Admin read of private documents is logged. Customers never receive document storage keys.

A user with several roles uses one account. Portal switch changes the default navigation. It does not bypass listing ownership checks.

## 6. Dependency map

Design screens map to modules. Nothing in the deferred column is a Phase 1 dependency.

| Screen | Depends on |
| --- | --- |
| Homepage | `search` published query, location list, demo-label flag |
| Search and map | `search`, listing card fields, MapLibre, PostGIS |
| Property details | `listings` public read, `inquiries`, `appointments`, `favorites`, `media` |
| Auth | `auth`, `profiles`, `ConsentRecord` |
| Customer dashboard | `favorites`, `inquiries`, `appointments`, `saved-searches` |
| Listing wizard | `listings`, `media`, `ListingFinancingOption`, status `draft` → `pending_review` |
| Agent CRM | `agent`, `inquiries`, `appointments`, own `listings` |
| Admin portal | `admin`, `ModerationCase`, `AuditLog`, private `ListingDocument` |

External runtime dependencies to approve before install:

- Node.js LTS, Next.js, React, TypeScript, Tailwind, Zod, Drizzle, PostgreSQL driver, PostGIS, Auth session library, S3 SDK, MapLibre.
- Local: Docker Compose for Postgres/PostGIS only, when implementation starts. Not installed in Phase 0.
- Explicitly not dependencies: LRA client, PRC client, payment gateway, mortgage calculator, e-sign, KYC vendor, WhatsApp Business API.

## 7. Risks

| Risk | Impact | Mitigation in this plan |
| --- | --- | --- |
| Stitch HTML over-claims title, PRC, and bank verification | Users could treat the marketplace as a title registry | Copy and badges follow stored status. README legal note is product copy. |
| Empty repository and missing Master Prompt | Stack might not match a prompt that lives outside the repo | This document is the proposal. Implementation waits for approval. |
| Private title PDFs | Document leak is a Data Privacy Act issue | `admin_only` keys, authorized download, audit on read. |
| Role switch in the header | Privilege mix-ups if UI role is trusted | Server checks ownership and role on every mutation. |
| Map and search scope | Bounding box plus many filters can stall a first release | Phase search uses indexed columns and bbox. Draw-area is the same bbox, not a custom polygon engine. |
| Agent CRM visuals include commissions, LOI, and closed-deal cash | Scope creep into escrow and tax advice | MVP pipeline stops at inquiry and viewing states. Commission figures are not stored. |
| Demo metrics (`₱45.8B`, `4,210 brokers`) | Misleading marketplace statistics | Seed data is labeled. Those counters are omitted until they are real aggregates. |
| Google Drive auth failure | Master Prompt constraints may still be unseen | Re-run Phase 0 delta if the prompt is supplied before build. |

## 8. Phased implementation plan

Each phase starts only after the previous one is accepted. Phase 0 stops here.

| Phase | Outcome | Done when |
| --- | --- | --- |
| 0 | This assessment | Approved or revised. No app code. |
| 1 | App skeleton, Postgres/PostGIS, migrations for identity and listings, session auth, role checks, seed locations | Register, login, and an empty authorized shell work locally. |
| 2 | Homepage and search (list). Published listings only. Demo label. | Guest can filter Buy/Rent, place, category, and price. |
| 3 | Listing detail, favorites, inquiry, viewing request | Customer can save, inquire, and request a slot. |
| 4 | Listing wizard through submit-for-review. Photo upload. | Owner or broker can submit a draft. It is not public yet. |
| 5 | Customer dashboard: saved, inquiries, appointments, saved searches | Dashboard reads the same records as phases 3–4. |
| 6 | Agent workspace: own listings, inquiry status, viewing confirm | Lister can move an inquiry and confirm a viewing. |
| 7 | Admin queue: approve, request changes, reject, audit row, user suspend | Only `published` listings appear in search. |
| 8 | Map split view, private document download, saved-search storage polish, responsive pass | Map bbox matches list filters. Documents stay private. |

Phase 8 does not add mortgage math, escrow, KYC document upload, live government APIs, or commission accounting.

## Approval needed

1. Accept the monolith stack in section 2, or replace it with the Master Prompt stack.
2. Accept the entity model, RBAC, and the rule that verification badges are stored decisions.
3. Confirm Phase 1 is the next build, still without LRA, PRC, bank, or KYC integrations.
