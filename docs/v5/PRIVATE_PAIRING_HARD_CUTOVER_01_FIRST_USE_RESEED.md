# PRIVATE-PAIRING-HARD-CUTOVER-01 — First-use / Reseed Playbook

**Marker:** `PRIVATE_PAIRING_HARD_CUTOVER_01_FIRST_USE_RESEED`  
**Constraint:** No Staging/Production mutation without Owner GO. This playbook is documentation only.

After platform ordered wipe (`sql/destructive/10_ORDERED_WIPE.sql`) truncates:

- `private_pairing_rule_targets`
- `private_pairing_rule_audit_logs`
- `private_pairing_rules`
- `private_pairing_rule_sets`

rule rows are empty. First admin use must reseed via **RPC only** (never direct table writes).

## Prerequisites

1. Private Pairing V2 SQL already present (Prod LIVE / Staging present).
2. Feature flags for admin/runtime as intended for the environment.
3. Under hard cutover staging SPA:
   - `VITE_PLATFORM_HARD_CUTOVER_ENABLED=true`
   - Canonical club/player repository flags ON
4. Owner tenant, Auth users, profiles preserved by wipe guards.

## Ordered first-use steps (Admin UI or RPC harness)

1. **Create Rule Set** — `private_pairing_create_rule_set`  
   Scope: usually `global` or `club` with real `scope_id`.
2. **Create rules** — `private_pairing_create_rule` + targets  
   Primary/target IDs must be canonical `playerId` from hard-cutover picker (no legacy blob IDs).
3. **Activate** — `private_pairing_activate_rule_set`  
   Only one active set per `(tenant_id, logical_id)`.
4. **Verify live load** — `private_pairing_get_active_rules_for_scope`  
   Same RPC used by `loadActiveRulesForLiveScope`.
5. **Optional audit** — `private_pairing_list_audit_logs`.

## Hard-cutover acceptance checks (read-only until Owner GO)

| Check | Expected |
|-------|----------|
| Admin CRUD | Succeeds via RPC; no SPA table DML |
| Runtime active-rule load | Returns activated rules for scope |
| Legacy picker | Fail-closed `PRIVATE_PAIRING_LEGACY_PICKER_FORBIDDEN` when canonical flags OFF |
| Missing rating | No silent `3.5`; warn/exclude/`INSUFFICIENT_RATED_PLAYERS` |
| Competition boundary | Does **not** write Competition Remote SSOT; pairing rules remain separate domain |

## Idempotency hint

Prefer deterministic rule-set names/keys such as:

`hard-cutover-seed::{tenantId}::private-pairing::{logicalId}`

Do **not** invent Auth users or change Owner UUID during reseed.

## Related

- Platform reseed order: `docs/platform-hard-cutover-01/phase-04/sql/reseed/README.md`
- Wipe truncates pairing tables: `docs/platform-hard-cutover-01/phase-04/sql/destructive/10_ORDERED_WIPE.sql`
- Staging acceptance: `docs/v5/PRIVATE_PAIRING_HARD_CUTOVER_01_STAGING_ACCEPTANCE.md`
