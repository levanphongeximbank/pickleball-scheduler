# A-PAIR Owner view RBAC — Staging only

**Target only:** Staging `qyewbxjsiiyufanzcjcq`  
**Production forbidden:** `expuvcohlcjzvrrauvud`  
**Owner GO required before apply. Do not auto-apply.**

## Why

Operator Acceptance A-PAIR calls `private_pairing_get_active_rules_for_scope` while
`VITE_PRIVATE_PAIRING_RULES_ENABLED=true`. Owner actors (`VENUE_OWNER` → normalize
`COURT_OWNER`) lack `pairing.private_rules.view` (currently SUPER_ADMIN /
PLATFORM_ADMIN only) → `PERMISSION_DENIED`.

Owner decision: keep Pairing enabled (no soft-pass by disabling the flag).

## Exact mappings

- `COURT_OWNER` → `pairing.private_rules.view`
- `VENUE_OWNER` → `pairing.private_rules.view`

Does **not** grant edit/manage/admin, does not grant every authenticated user,
does not elevate SUPER_ADMIN, does not mutate Auth/profile/membership.

## Files

| File | Purpose |
|------|---------|
| `10_OWNER_PAIRING_VIEW_RBAC.sql` | Idempotent permission + role_permissions insert |
| `99_VERIFY.sql` | Read-only verify |
| `90_ROLLBACK.sql` | Delete exact Owner mappings only |
