# RBAC.md — PropertyFinder PH

Roles: `CUSTOMER`, `PROPERTY_OWNER`, `REAL_ESTATE_AGENT`, `ADMIN`. Multi-role accounts allowed; portal switch does not bypass checks.

## Permissions (target)

| Permission | C | O | A | Admin |
| --- | --- | --- | --- | --- |
| profile:* | ✓ | ✓ | ✓ | ✓ |
| favorite:manage | ✓ | ✓ | ✓ | ✓ |
| inquiry:create / manage_own | ✓ | ✓ | ✓ | ✓ |
| inquiry:manage_assigned | — | ✓ | ✓ | ✓ |
| appointment:manage | ✓ | ✓ | ✓ | ✓ |
| listing:create / manage_own | — | ✓ | ✓ | ✓ |
| listing:moderate | — | — | — | ✓ |
| report:create | ✓ | ✓ | ✓ | ✓ |
| admin:* | — | — | — | ✓ |

## Hard rules

1. **Ownership:** Owners mutate only `owner_user_id = self`. Agents mutate only assigned `broker_user_id = self` (or owned).
2. **No self-approval:** `listing:moderate` denied if actor is owner or broker on that listing (even for ADMIN acting as listing party — admin may moderate others’ listings only; if admin is also owner, use a second admin or break-glass policy documented as “admin may moderate own listing only with audit flag” — **MVP default: deny self-approval always**).
3. **Customers:** No admin/moderation routes.
4. **Suspended:** No submit, renew, availability→AVAILABLE, or publish-equivalent actions.
5. **PII:** Customer contact visible only to assignee/admin on inquiry/appointment; never in `/search` or public listing JSON.
6. **Documents:** `admin_only` storage keys never returned to customers.
7. **Backend validation required** on every route; UI hiding is insufficient.

## Public vs private reads

| Resource | Guest | Customer | Owner/Agent | Admin |
| --- | --- | --- | --- | --- |
| Search hits | APPROVED+AVAILABLE+fresh | same | same | same + private dashboards |
| Listing detail public | if searchable | same | + own non-public via `/list/:id` | all via admin |
| Inquiry thread | — | own | assigned | all |
