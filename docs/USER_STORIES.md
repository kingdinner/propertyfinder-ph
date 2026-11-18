# USER_STORIES.md — PropertyFinder PH

Format: As a … I want … so that …  
**Acceptance** summaries are MVP-oriented. Full transition matrices live in workflow docs.

## Customer

1. As a customer, I want unified Buy/Rent search with filters that combine correctly, so I can find available approved homes.
2. As a customer, I want URL-persistent filters and clear chips, so I can share and refine searches.
3. As a customer, I want to favorite published available listings, so I can shortlist homes.
4. As a customer, I want to inquire without creating duplicates on rapid double-submit, so agents are not spammed.
5. As a customer, I want to request, cancel, or ask to reschedule a viewing in Asia/Manila time, so scheduling is clear.
6. As a customer, I want my phone/email hidden from public pages, so my privacy is protected.
7. As a customer, I want loading/empty/error feedback on every workflow, so failures are not silent.

## Owner / Agent

8. As an owner/agent, I want category-dependent listing forms, so I do not enter irrelevant fields.
9. As an owner/agent, I want to submit listings for review and resubmit after rejection/correction, so listings can go live.
10. As an owner/agent, I want to update availability (AVAILABLE/RESERVED/SOLD/RENTED/UNAVAILABLE) without changing moderation, so inventory stays accurate.
11. As an owner/agent, I want expiration notices and renewal, so listings stay searchable when still offered.
12. As an owner/agent, I want material edits on approved listings to require reapproval, so public data stays trustworthy.
13. As an owner/agent, I want media upload with order, cover, delete, preview, and size/type checks, so galleries are reliable.
14. As an owner/agent, I want to manage only my owned/assigned inquiries and appointments, so permissions stay correct.
15. As an agent, I want follow-up dates and internal notes on inquiries, so I can work leads without exposing notes to customers.
16. As an owner/agent, I cannot approve my own listings, so moderation remains independent.

## Administrator

17. As an admin, I want a pending queue with approve / reject-with-reason / request correction / archive, so quality is enforced.
18. As an admin, I want listing history and audit of my actions, so decisions are accountable.
19. As an admin, I want to suspend users and review agent license declarations, so abuse can be limited.
20. As an admin, I want to review reported listings, so policy violations can be handled.
21. As an admin, I want basic real analytics from DB counts, so I never rely on fake statistics.

## System

22. As the system, I exclude non-APPROVED, non-AVAILABLE, archived, and expired listings from public available search.
23. As the system, I prevent conflicting confirmed appointments for the same listing and host using transactional locking.
24. As the system, I emit in-app notifications for the defined event catalog, with email pluggable later.
