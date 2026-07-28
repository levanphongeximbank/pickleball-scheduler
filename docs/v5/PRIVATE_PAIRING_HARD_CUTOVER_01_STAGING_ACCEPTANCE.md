# PRIVATE-PAIRING-HARD-CUTOVER-01 — Staging Acceptance Plan

**Marker:** `PRIVATE_PAIRING_HARD_CUTOVER_01_STAGING_ACCEPTANCE_READY`  
**Status:** Read-only / rollback-safe plan. **No Staging mutation without Owner GO. No Production mutation.**

## Scope

Canonical Runtime Authority for Private Pairing Rules under `VITE_PLATFORM_HARD_CUTOVER_ENABLED`:

1. Register `private_pairing_rules` in `runtimeAuthorityMatrix`
2. Forbid `legacy_blob` picker under hard cutover
3. Replace silent rating `3.5` under hard cutover with warn/exclude/fail-closed
4. Document first-use/reseed after ordered wipe

Out of scope: Player Rating ownership changes, Competition Remote SSOT finalization, SQL apply, Production.

## Pre-flight (read-only)

| # | Action | Mutates? |
|---|--------|----------|
| 1 | Confirm Staging has 4 `private_pairing_*` tables + RPC catalog | No |
| 2 | Confirm SPA Preview env flags (document only) | No |
| 3 | Run unit suite `tests/private-pairing-hard-cutover-01.test.js` locally | No |
| 4 | Confirm PR #328 (M8 text-tenant hotfix) is **not** modified by this branch | No |

## Acceptance matrix (Owner GO required for live Staging)

| ID | Scenario | Expected | GO gate |
|----|----------|----------|---------|
| A1 | Admin CRUD create/update/disable/activate via UI | RPC-only writers; UI reflects rows | Staging write GO |
| A2 | Runtime active-rule load for scope | `private_pairing_get_active_rules_for_scope` returns active set | Read-only OK after seed |
| A3 | Hard cutover ON + canonical flags OFF | Picker `ok:false`, code `PRIVATE_PAIRING_LEGACY_PICKER_FORBIDDEN` | Unit covers; Staging SPA flag GO |
| A4 | Hard cutover OFF + canonical OFF | `legacy_blob` still allowed (compat) | Unit |
| A5 | Missing rating under hard cutover | Exclude/warn; no silent 3.5; insufficient → `INSUFFICIENT_RATED_PLAYERS` | Unit |
| A6 | Competition boundary | Pairing domain ≠ `competition_match_result`; no SSOT finalize claim | Unit + code review |
| A7 | First-use after wipe | Follow `PRIVATE_PAIRING_HARD_CUTOVER_01_FIRST_USE_RESEED.md` | Wipe/reseed Owner GO |

## Rollback-safe notes

- Code rollback = redeploy previous SPA SHA (flags OFF restores legacy picker defaults).
- Do **not** DROP Private Pairing tables (already Production LIVE).
- Ordered wipe is a separate platform Owner GO; this package does not authorize it.

## Evidence to collect when Owner GO is granted

1. Screenshot/RPC result of rule-set create + activate
2. RPC result of `private_pairing_get_active_rules_for_scope`
3. Unit test log + build/lint from this branch
4. Confirmation Production mutations = 0

## Blockers (current)

- Staging SPA hard-cutover flag cutover requires Owner deploy GO
- Ordered wipe / reseed requires separate platform rehearsal Owner GO
- Do not execute acceptance writes from agent until marker `PRIVATE_PAIRING_HARD_CUTOVER_01_STAGING_OWNER_GO`
