# Phase 5 Ordered Runbook Draft (NOT EXECUTION-READY)

**Status:** DRAFT corrected for Owner HOLD (`PHASE5A_V2`) — sequence honesty only.  
**Owner architecture:** `canonicalMigrationScope = M0_TO_M11_ACCEPTED`.  
**`executionRunbookAccepted = false`** — do **not** treat this file as an execution-ready runbook.  
**`productionExecutionGo = false`**.  
**Decision context:** `BLOCKED_PHASE5_READINESS`.  
**Do not issue:** `PLATFORM_HARD_CUTOVER_01_PHASE_05_COMPLETE`.

## Document conflict resolution

| Source | Says | Classification |
|--------|------|----------------|
| `phase-04/PRODUCTION_CUTOVER_PLAN.md` | Apply migrations **M1→M8** | **Stale / incomplete** |
| `phase-04/staging-rehearsal/STAGING_REHEARSAL_PLAN.md` | Apply **M1→M8** | **Stale relative to manifest** |
| `phase-04/manifests/MIGRATION_MANIFEST.md` | Apply order **M0→M11** | **Canonical SCOPE/ORDER baseline (Owner ACCEPTED)** |

Owner accepts **M0→M11** as migration scope/order baseline only. This draft corrects build-time flag vs deploy sequencing and M9–M11 honesty. It is **not** accepted for Production execution.

## Hard stops (any fail → STOP)

1. Production project_ref = `expuvcohlcjzvrrauvud` (never Staging `qyewbxjsiiyufanzcjcq`).
2. **Proven Production backup + restore entry** visible/usable. If not → **BLOCKED**.
3. M9–M11 execution packs complete (`IMPLEMENTATION_REQUIRED` until packaged with paths + checksums + verify + rollback + Production applicability).
4. Owner GO recorded; `executionRunbookAccepted` must become true via separate Owner accept of a complete pack — not this draft alone.

## Corrected execution sequence (Production — future Owner GO only)

`VITE_*` flags are read from `import.meta.env` and require a **new build/deployment**.  
Do **not** deploy SPA before setting approved Production `VITE_*` values.  
Do **not** enable hard-cutover runtime before reseed verification PASS.

| Step | Action | Notes / stop |
|-----:|--------|----------------|
| 1 | Proven Production backup + restore entry | STOP if not proven |
| 2 | Maintenance / quiesce gate | Prevent business writes during destructive window |
| 3 | Identity precheck + protected guards | `00_IDENTITY_PRESERVE_PRECHECK.sql`, `01_PROTECTED_OBJECT_GUARDS.sql` — STOP if FAIL |
| 4 | Apply/verify required **M0→M11** families | M0 verify-only if already locked; M1–M8 authored packs; **M9–M11 only after IMPLEMENTATION_REQUIRED packs exist** — STOP per family verify |
| 5 | Ordered wipe | `10_ORDERED_WIPE.sql` — requires step 1 |
| 6 | Permanently **DROP** `club_ai_data` | `20_DROP_CLUB_AI_DATA.sql` only after dependency-closure PASS + proven backup/restore; **NO RECREATE** |
| 7 | Post-wipe structural + protected-row verification | `30_POST_WIPE_VERIFY.sql` — STOP / restore if FAIL |
| 8 | Reseed 01–17 + `99_VERIFY_RESEED.sql` | STOP if verify FAIL |
| 9 | Keep hard-cutover flags **OFF** until migrations + wipe + reseed verification PASS | Soft-fail closed |
| 10 | Set approved Production `VITE_*` values **BEFORE** build | Names only in docs: `VITE_PLATFORM_HARD_CUTOVER_ENABLED`, `VITE_COMPETITION_REMOTE_SSOT_ENABLED`, optional `VITE_PICK_VN_RATING_V5_ENABLED` |
| 11 | Build/deploy approved source SHA so flags are compiled into SPA | Never deploy then hope to flip build-time flags |
| 12 | Verify deployment SHA, Ready/Current, aliases | STOP if mismatch |
| 13 | Production smoke + Operator Acceptance | Runner only after cutover deploy |
| 14 | Issue `PHASE_05_COMPLETE` | Only after every gate PASS |

## Object classification (do not overclaim)

1. **Row-preserved infrastructure/catalog** (`NOT_IN_WIPE_TARGET` / `ROW_COUNTS_PRESERVED`):  
   `auth.users`, `profiles`, `venues`, `tenant_members`, `roles`, `permissions`, `role_permissions`, `plans`, `plan_limits`.
2. **Schema/function-preserved; business rows intentionally wiped + reseeded**:  
   `club_data_v3`, Rating V5 tables/config, public_catalog backing tables.
3. **`public_catalog_list_*` RPCs**: `FUNCTION_OBJECTS_PRESERVED` — not the same as backing-table row preservation.

## M9–M11 honesty

| Family | Execution pack status | Note |
|--------|----------------------|------|
| M9 | `IMPLEMENTATION_REQUIRED` | Scattered TT SQL candidates exist under `docs/v5/`; **no** Production ordered pack with checksums/verify/rollback |
| M10 | `IMPLEMENTATION_REQUIRED` | Referee V5 SQL candidates under `docs/v5/referee-v5/`; **not** Production-packaged |
| M11 | `IMPLEMENTATION_REQUIRED` | Digest SQL artifact **not found** in repo; RC1 only on Production |

“Promote from Staging” alone is **not** an execution-ready instruction. Do not invent/export/apply SQL in Phase 5A.

## `club_ai_data` permanent DROP

- Owner target: **PERMANENT DROP / NO RECREATE**.
- Read-only Production dependency inventory (Phase 5A V2): **`DEPENDENCY_CLOSURE_PASS_FOR_PERMANENT_DROP`** (no inbound FK/views/function refs; self-owned policy/pkey only).
- Execute still requires proven backup/restore + Owner GO.

## Phase 5A non-goals

No Production/Staging SQL apply, wipe, DROP, reseed, backup create/restore, flag/env change, deploy, or Operator Runner.
