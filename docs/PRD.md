# PRD.md — PropertyFinder PH

**Status:** Phase 0 — awaiting approval of additional functional requirements.  
**Product:** Philippine property marketplace for discovery, listing management, inquiries, and viewings.

## 1. Problem

Buyers, renters, owners, and agents need one marketplace to list, find, inquire about, and schedule viewings for Philippine properties — without implying legal title verification or running escrow/mortgage products in MVP.

## 2. Goals

1. Unified Buy/Rent search with server-side filters and URL persistence.
2. Dual property lifecycle: **listing moderation** independent of **availability**.
3. Category-correct listing forms and financial validation (FE + BE).
4. Secure ownership/assignment permissions.
5. Inquiry and appointment workflows with auditability and Manila-local display times.
6. Admin moderation that never claims legal ownership certification.

## 3. Non-goals (deferred)

Escrow, digital leases, mortgage comparison, live LRA/PRC APIs, mandatory KYC uploads, commission automation, yield analytics, CRM automation, revenue forecasting, ML duplicate detection, calendar sync.

## 4. Personas

| Persona | Needs |
| --- | --- |
| Guest / Customer | Search, favorite, inquire, request viewing |
| Property owner | List, renew, set availability, answer inquiries |
| Real estate agent | Manage assigned listings and leads |
| Administrator | Moderate listings, users, agents, reports |

## 5. Success metrics (real data only)

- Count of APPROVED+AVAILABLE listings in search (live query).
- Inquiry response rate (assigned inquiries moved from NEW).
- Confirmed viewings / requested viewings.
- Median moderation turnaround.
- No fabricated GMV or broker-count marketing stats.

## 6. Functional scope (MVP after Phase 0 approval)

Covered in detail by BUSINESS_RULES, PROPERTY_LIFECYCLE, SEARCH_WORKFLOW, INQUIRY_WORKFLOW, APPOINTMENT_WORKFLOW, RBAC, API_DESIGN, DATABASE_DESIGN.

Baseline already shipped: auth, listings (single status), search (published), media (local), inquiries/appointments, dashboards, reports.

Delta after approval: dual status, expiration/renewal, reapproval, duplicates (basic), availability, expanded categories/fields, search AND/OR + autocomplete, media UX completion, inquiry duplicate/notes/follow-up, notification catalog completion.

## 7. Legal / trust copy

Platform approval ≠ ownership or clean-title certification. Declared title and PRC fields are self-declared until reviewed as stored status only.
