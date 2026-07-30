# Owner pairing.view revoke — Staging security reconciliation

**Target only:** Staging `qyewbxjsiiyufanzcjcq`  
**Production forbidden:** `expuvcohlcjzvrrauvud`  
**Owner GO required before apply. Do not auto-apply in authoring turns.**

## Contract (Owner final authorization)

Private Pairing is a restricted capability for sessions with `is_super_admin() = true` only.

- `TENANT_OWNER` / `COURT_OWNER` / `VENUE_OWNER` must not view, manage, audit, or simulate.
- Keep `private_pairing_can()` and `private_pairing_tenant_visible()` requiring `is_super_admin()`.
- Do **not** apply any SQL from rejected PR #348 (`pairing-owner-same-tenant-view`).

## Exact rollback to apply (Owner GO)

Reuse without modification:

`docs/platform-hard-cutover-01/phase-04/sql/pairing-owner-view-rbac/90_ROLLBACK.sql`

Then run read-only:

`docs/platform-hard-cutover-01/phase-04/sql/pairing-owner-view-rbac/99_REVOKE_VERIFY.sql`

## Verify expectations

| Check | Expected |
|-------|----------|
| Owner-like `pairing.private_rules.*` mappings | `0` |
| `private_pairing_can` | still requires `is_super_admin()` |
| `private_pairing_tenant_visible` | still requires `is_super_admin()` |
| SUPER_ADMIN / PLATFORM_ADMIN pairing grants | unchanged |
