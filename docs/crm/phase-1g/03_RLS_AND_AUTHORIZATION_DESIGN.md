# 03 — RLS and Authorization Design (Phase 1G)

**Status:** Policies authored — **not applied**

---

## Verified helpers only

Policies and `crm_phase1g_scope_allows(tenant_id, venue_id)` use:

- `auth.uid()`
- `public.user_venue_id()`
- `public.user_has_permission(text)`
- `public.is_super_admin()`

No role-name-only authorization. No anonymous policies. No first-club / first-venue fallback. Missing tenant/venue context denies access.

## Sprint-2 identity constraint

PICK_VN currently binds JWT callers via `profiles.venue_id` (`user_venue_id()`). There is **no verified** dual-scope `user_tenant_id()` distinct from venue.

Therefore Phase 1G RLS requires:

```text
venue_id = user_venue_id()
AND tenant_id = user_venue_id()
```

This is fail-closed. CRM rows where `tenant_id <> venue_id` are not JWT-accessible until Identity publishes a verified tenant helper. Application-layer `TenantVenueScope` may still use distinct ids for memory/tests.

## Permission matrix (RLS)

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| crm_tags | crm.tag.view (+ create/update/assign) | crm.tag.create | crm.tag.update | none |
| crm_tag_assignments | crm.tag.view / assign | crm.tag.assign | none | crm.tag.assign |
| crm_consent_records | crm.consent.view (+ create/revoke) | create / revoke | none | none |
| crm_pending_events | crm.audit.view | crm.audit.view | crm.audit.view | none |

`is_super_admin()` is allowed as an explicit override on all of the above.

## Deferred

- Seeding CRM permission keys into Identity `role_permissions` (required before non-admin JWT access)
- Dual-scope tenant helper when Identity supports tenant ≠ venue
- service_role worker grants (Phase 1H+)
