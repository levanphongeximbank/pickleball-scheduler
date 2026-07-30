# A-COURT FORBIDDEN remediation — venue-scoped owner upsert

**Target only:** Staging `qyewbxjsiiyufanzcjcq`  
**Production forbidden:** `expuvcohlcjzvrrauvud`  
**Owner GO required before apply. Do not auto-apply.**

## Diagnosis

`court_admin_upsert_cluster` returns `FORBIDDEN` when `can_review_court_claim()` is false.

`can_review_court_claim()` = `is_super_admin() OR user_has_permission('cluster.manage')`.

Live `cluster.manage` is granted only to `SUPER_ADMIN` / `PLATFORM_ADMIN` / `SYSTEM_TECHNICIAN`.

Operator actor is app `TENANT_OWNER` (DB `VENUE_OWNER` → normalize `COURT_OWNER`) on `venue-staging-a` with `isSuperAdmin=false`, so `can_review_court_claim()` is false.

## Chosen remediation

Replace **only** `court_admin_upsert_cluster` auth gate:

1. Keep platform path: `can_review_court_claim()`
2. Add venue-scoped owner path: active owner-like profile whose `user_venue_id()` equals target `venue_id`
3. Do **not** grant `cluster.manage` to all owners (would unlock platform-wide claim review)
4. Do **not** elevate actor to SUPER_ADMIN
5. Do **not** use service_role in runner

Owner-like roles accepted for own venue: `COURT_OWNER`, `VENUE_OWNER`, `TENANT_OWNER` (raw or via `normalize_profile_role`).

## Apply order

1. `10_COURT_ADMIN_UPSERT_VENUE_OWNER_AUTH.sql`
2. `99_VERIFY.sql` (read-only)
