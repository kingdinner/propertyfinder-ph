# PropertyFinder PH

Philippine property marketplace demo built with **Next.js 15**, **Postgres**, **Drizzle ORM**, and **Tailwind CSS 4**.

Buyers and renters can search published listings, save favorites, send inquiries, and request viewings. Owners and brokers draft listings and submit them for review. Admins moderate listings, users, agent licenses, and reports.

> Platform listing review is **not** proof of legal ownership or a clean title. License numbers in demo data are sample profile fields.

## Features

- Public search (sale/rent) with filters, grid/list/map views, and favorites
- Auth + RBAC: `CUSTOMER`, `PROPERTY_OWNER`, `REAL_ESTATE_AGENT`, `ADMIN`
- Listing lifecycle: draft → pending review → published / needs revision / rejected
- Inquiries and appointment requests (Asia/Manila)
- Customer, owner/agent, and admin dashboards
- Local image uploads served from `/uploads/...`

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 15 App Router + React 19 + TypeScript |
| UI | Tailwind CSS 4 |
| DB | PostgreSQL + Drizzle ORM |
| Auth | bcrypt + jose (HS256) session cookie `pf_session` |
| Validation | Zod |
| Tests | Vitest + Testing Library |

## Prerequisites

- Node.js 20+ (22/24 OK)
- PostgreSQL running locally
- `npm` available

## Quick start

```bash
# 1) Install
npm install

# 2) Env
cp .env.example .env.local
# Edit DATABASE_URL / TEST_DATABASE_URL / AUTH_SECRET if needed

# 3) Create databases (example names from .env.example)
createdb propertyfinder_ph
createdb propertyfinder_ph_test

# 4) Migrate + seed demo data
npm run db:migrate
npm run db:seed

# 5) Run the app
npm run dev -- --port 3456
```

Open [http://localhost:3456](http://localhost:3456).

### Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@propertyfinder.ph` | `ChangeMeAdmin1!` |
| Customer | `alex.mercado@example.com` | `DemoPass1!` |
| Owner | `owner.lipa@example.com` | `DemoPass1!` |
| Agent | `maria.santos@example.com` | `DemoPass1!` |
| Agent | `jonathan.dee@example.com` | `DemoPass1!` |

The login page also lists these as one-click demo fillers.

Seed creates **6 published** listings, **1 pending review**, **1 draft**, plus sample favorites, inquiry, and viewing request.

Re-seed anytime:

```bash
npm run db:seed
```

## How to test

### Automated

```bash
npm run typecheck
npm run lint
npm test
```

Vitest covers foundation UI, auth/RBAC, listings lifecycle, search/favorites, inquiries/appointments, and dashboards (uses `TEST_DATABASE_URL`).

### Manual smoke checklist

1. **Public**
   - Home shows featured published listings with cover images
   - `/search` Buy / Rent filters return the right inventory
   - Open a listing detail page from a card
2. **Customer** (`alex.mercado@example.com`)
   - Sign in from `/login` → lands on dashboard
   - Favorites / inquiries / viewings tabs load seeded data
   - From search, save a listing; from detail, send an inquiry
3. **Owner / agent** (`owner.lipa@example.com` or `maria.santos@example.com`)
   - `/agent` shows listings, inquiries, appointments
   - `/list` creates or edits a draft and can submit for review
4. **Admin** (`admin@propertyfinder.ph`)
   - `/admin` moderation queue can approve / request changes / reject
   - Users, Agents, Reports, Analytics tabs load without stale cross-tab data
5. **Auth gates**
   - Logged-out visit to `/list`, `/agent`, `/admin` redirects to `/login?next=...`
   - Customer visiting `/admin` is redirected with a forbidden notice

### Useful scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run db:migrate` | Apply Drizzle SQL migrations |
| `npm run db:seed` | Upsert demo users + listings |
| `npm test` | Run Vitest suite |
| `npm run typecheck` | TypeScript `tsc --noEmit` |
| `npm run lint` | ESLint |

## Project layout

```text
src/app/                 App Router pages + API routes
src/components/          UI (search, listings, dashboards, layout)
src/db/                  Drizzle schema, migrate, seed
src/lib/                 Auth, search, listings, inquiries, dashboards
docs/                    Phase 0 assessment / design notes
drizzle/                 SQL migrations
```

## Environment

See `.env.example`:

- `DATABASE_URL` — app database
- `TEST_DATABASE_URL` — isolated DB for Vitest
- `AUTH_SECRET` — ≥32 characters for session JWTs
- `NEXT_PUBLIC_APP_URL` — absolute app URL used in emails/links

Do **not** commit `.env.local`.

## License

Private demo / learning project. Not a production MLS or title verification system.
