# Phase 5 Ordered Runbook Draft (NOT EXECUTION-READY)

**Status:** DRAFT updated by Phase 5B packaging — still **not** Owner-accepted for execution.  
**Owner architecture:** `canonicalMigrationScope = M0_TO_M11_ACCEPTED`.  
**`executionRunbookAccepted = false`** — do **not** treat this file as an execution-ready runbook.  
**`productionExecutionGo = false`**.  
**Decision context:** `BLOCKED_PHASE5_READINESS`.  
**Phase 5B package decision:** `BLOCKED_PHASE5B_EXECUTION_PACKAGE` (V2 integrity correction; see evidence `05_PHASE5B_DECISION_2026-07-31.json`).  
**Do not issue:** `PLATFORM_HARD_CUTOVER_01_PHASE_05_COMPLETE`.

**Candidate (exact sequence):**  
`docs/platform-hard-cutover-01/phase-05b-execution-package/PHASE5_ORDERED_RUNBOOK_CANDIDATE.md`  
Checksum SSOT field: `sha256ExactGitBlobBytes`. M11 action: `VERIFY_ONLY_ALREADY_EQUIVALENT`. TT5D is non-executable candidate only.

## Document conflict resolution

| Source | Says | Classification |
|--------|------|----------------|
| `phase-04/PRODUCTION_CUTOVER_PLAN.md` | Apply migrations **M1→M8** | **Stale / incomplete** |
| `phase-04/staging-rehearsal/STAGING_REHEARSAL_PLAN.md` | Apply **M1→M8** | **Stale relative to manifest** |
| `phase-04/manifests/MIGRATION_MANIFEST.md` | Apply order **M0→M11** | **Canonical SCOPE/ORDER baseline (Owner ACCEPTED)** |
| Phase 5B `M0_M11_EXECUTION_MANIFEST.json` | Exact interleaved M9A→M10→M9B→M11 | **Package SSOT for artefact paths/checksums; not Owner GO** |

Owner accepts **M0→M11** as migration scope/order baseline only. This draft is **not** accepted for Production execution.

## Hard stops (any fail → STOP)

1. Production project_ref = `expuvcohlcjzvrrauvud` (never Staging `qyewbxjsiiyufanzcjcq`).
2. **Proven Production backup + restore entry** visible/usable. If not → **BLOCKED** (cannot waive).
3. M9–M11 execution packs must be Owner-ready. Phase 5B status:
   - M9: packaged but **BLOCKED** — TT5D Staging catalog not proven
   - M10: packaged **READY** (static)
   - M11: packaged **READY** as `STAGING_CATALOG_DERIVED` (live Staging=Production equivalent)
4. Owner GO recorded; `executionRunbookAccepted` must become true via separate Owner accept — not this draft alone.

## Corrected execution sequence (Production — future Owner GO only)

`VITE_*` flags are read from `import.meta.env` and require a **new build/deployment**.  
Do **not** deploy SPA before setting approved Production `VITE_*` values.  
Do **not** enable hard-cutover runtime before reseed verification PASS.

| Step | Action | Notes / stop |
|-----:|--------|----------------|
| 1 | Proven Production backup + restore entry | STOP if not proven |
| 2 | Maintenance / quiesce gate | Prevent business writes during destructive window |
| 3 | Target/project-ref guard | Production only |
| 4 | Identity precheck + protected guards | `00_IDENTITY_PRESERVE_PRECHECK.sql`, `01_PROTECTED_OBJECT_GUARDS.sql` — STOP if FAIL |
| 5 | **M0 verify-only** | Already locked on Production |
| 6 | Apply/verify **M1→M8** | Existing authored packs; M8 text-tenant contract; STOP per family |
| 7 | **M9A** TT2B–TT4 → **M10** → **M9B** TT5B–TT6B → **M11** | Exact paths in Phase 5B manifests; STOP per family; M9 currently package-BLOCKED on TT5D |
| 8 | Ordered wipe | `10_ORDERED_WIPE.sql` — requires step 1 |
| 9 | Permanently **DROP** `club_ai_data` | After dependency-closure PASS; **NO RECREATE** |
| 10 | Post-wipe structural + protected-row verification | STOP / restore if FAIL |
| 11 | Reseed 01–17 + `99_VERIFY_RESEED.sql` | STOP if verify FAIL |
| 12 | Keep hard-cutover flags **OFF** until migrations + wipe + reseed verification PASS | Soft-fail closed |
| 13 | Set approved Production `VITE_*` values **BEFORE** build | Build-time flags |
| 14 | Build/deploy approved source SHA | Never deploy then hope to flip build-time flags |
| 15 | Verify deployment SHA, Ready/Current, aliases | STOP if mismatch |
| 16 | Production smoke + Operator Acceptance | Runner only after cutover deploy |
| 17 | Issue `PHASE_05_COMPLETE` | Only after every gate PASS |

## M9–M11 honesty (Phase 5B)

| Family | Package status | Note |
|--------|----------------|------|
| M9 | `BLOCKED_STAGING_CATALOG_NOT_PROVEN_FOR_TT5D` | Ordered pack + checksums exist under `phase-05b-execution-package/sql/m9-team-tournament/`; TT5D not proven on Staging catalog |
| M10 | `READY` (static package) | `sql/m10-referee-v5/`; excludes V5D3/V5D4/V5E1; legacy token RPCs preserved |
| M11 | `READY_STAGING_CATALOG_DERIVED_ALREADY_EQUIVALENT_ON_PRODUCTION` | Original PR4 digest SQL not in git; catalog-derived `extensions.digest` body; Staging↔Production def_md5 match |

“Promote from Staging” alone remains **not** an execution-ready instruction. Phase 5B did **not** apply SQL.

## `club_ai_data` permanent DROP

- Owner target: **PERMANENT DROP / NO RECREATE**.
- Phase 5A: **`DEPENDENCY_CLOSURE_PASS_FOR_PERMANENT_DROP`**.
- Execute still requires proven backup/restore + Owner GO.

## Phase 5B non-goals

No Production/Staging SQL apply, wipe, DROP, reseed, backup create/restore, flag/env change, deploy, or Operator Runner.
