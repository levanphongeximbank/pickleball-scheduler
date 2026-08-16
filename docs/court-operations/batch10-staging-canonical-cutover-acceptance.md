# Batch 10 — Staging Canonical Cutover Acceptance

**Date:** 2026-08-16  
**PR:** #438 (OPEN / DRAFT / UNMERGED)  
**Staging project:** `qyewbxjsiiyufanzcjcq`  
**Production project:** `expuvcohlcjzvrrauvud` (untouched)

## Baseline

| Field | Value |
| --- | --- |
| HEAD_BEFORE (Owner GO expect) | `0f27a99b78ab64887b72bc29b730870bf02c1eb4` |
| HEAD_AFTER | `9098e660beb9548e377c8bb35bb7f1fa27c470dd` |
| ORIGIN_MAIN | `c8724e4c1d06a5489c4de4a86a29e59970039068` |
| LATEST_MAIN_STILL_RECONCILED | YES |

Source remediation commits on branch after Owner GO HEAD:

1. `fadd0bc2` — Batch7 `court_resource_digest_sha256` + Vite flag wiring  
2. `9098e660` — LF-normalized certified hash pins + Staging cert tooling  

## Preview

| Field | Value |
| --- | --- |
| PREVIEW_URL (Vercel @ 9098e660) | `https://pickleball-scheduler-9co46wwwz-pickleball-scheduler.vercel.app` |
| PREVIEW_BINDS_STAGING | YES (`https://qyewbxjsiiyufanzcjcq.supabase.co` inlined) |
| Netlify DP-438 | Present but **no** inlined Supabase URL — do not use for Batch10 browser |

## Schema package state (Staging)

All VERIFY scripts PASS after apply:

| Package | State | Action |
| --- | --- | --- |
| Phase3A | PRESENT_MATCHING | verify only |
| Phase3B | PRESENT_MATCHING | verify only |
| D4 | PRESENT_MATCHING | verify only |
| Batch1 | PRESENT_MATCHING | applied in 10C |
| Batch2 | PRESENT_MATCHING | applied in 10C |
| Batch3 | PRESENT_MATCHING | applied in 10C |
| Batch4 | PRESENT_MATCHING | applied in 10C |
| Batch7 | PRESENT_MATCHING | applied after digest remediation |
| Batch8 | PRESENT_MATCHING | applied in 10C |
| identity-guard-01 | PRESENT_MATCHING | applied in 10C |

`STAGING_SCHEMA_COMPLETE=YES`  
`STAGING_SCHEMA_DRIFT=0`  
`IDENTITY_GUARD_STAGING=PASS` (live def uses `cc.tenant_id`, unknown-cluster fail-closed)  
`PHYSICAL_TENANT_VALIDATES_CLUSTER_VENUE=NO`

## Data migration

Legacy `club_data_v3` bookings: **2** rows (2026-08-14 tournament), both past → `COMPATIBILITY_ONLY`.  
No active/future unresolved capacity. No fabricated migration.

| Gate | Value |
| --- | --- |
| LEGACY_DATA_DRY_RUN | PASS |
| UNRESOLVED_ACTIVE_OR_FUTURE_CAPACITY_RECORDS | 0 |
| UNRESOLVED_PHYSICAL_COURT_MAPPING_COUNT | 0 |
| MIGRATED_BOOKING_ROWS | 0 (historical only) |
| DATA_MIGRATION_RECONCILIATION | PASS |
| STALE_EPHEMERAL_STATE_MIGRATED | NO |

## Backend certification (Staging)

Fixture prefix: `COURT_BATCH10_CERT_`  
Defaults OFF suite PASS; SQL cutover ON smoke PASS.

| Gate | Value |
| --- | --- |
| CANONICAL_BACKEND_STAGING | PASS |
| SELF_CONFLICT_6_OF_6 | PASS |
| CROSS_MODULE_PAIR_COUNT | 15 |
| CROSS_MODULE_PAIR_PASS_COUNT | 15 |
| REAL_STAGING_DB_CONCURRENCY | PASS |
| MULTI_COURT_ATOMICITY | PASS |
| IDEMPOTENCY | PASS |
| OWNER_SAFE_RELEASE | PASS |
| TENANT_ISOLATION | PASS |
| CLUB_ACCESS | PASS |
| UNINTENDED_FIXTURE_ROWS_REMAINING | 0 |

## Control activation

| Control | Final Staging state |
| --- | --- |
| SQL `court_resource_reservation_cutover.enabled` | **ON** |
| `VITE_CANONICAL_RESERVATION_CUTOVER` | **OFF** (Preview not set) |
| `VITE_CANONICAL_BOOKING_LIFECYCLE` | **OFF** |
| `VITE_CANONICAL_RESOURCE_BLOCKS` | **OFF** |
| `VITE_CANONICAL_COMPETITION_COURT_ADAPTERS` | **OFF** |
| `VITE_CANONICAL_COURT_LIVE_RUNTIME` | **OFF** |

Activation completed through STEP 1 (SQL) + backend smoke.  
STEPS 2–6 require Vercel **Preview** env vars (no Production mutation). No Vercel token in agent environment.

## Functional rollback

| Gate | Value |
| --- | --- |
| FUNCTIONAL_ROLLBACK_TO_OFF | PASS (SQL OFF + backend smoke) |
| RESTORE_CANONICAL_ON_AFTER_ROLLBACK | PASS (SQL ON + backend smoke) |
| IDENTITY_GUARD_ROLLBACK_DEPENDENCY_DOCUMENTED | YES (Batch8 + identity-guard not independently safe) |

## Real-browser acceptance

**Not completed.** Blocked on Preview Vite cutover flags remaining OFF while SQL is ON.

Owner must set on Vercel Preview only (not Production):

```
VITE_CANONICAL_RESERVATION_CUTOVER=true
VITE_CANONICAL_BOOKING_LIFECYCLE=true
VITE_CANONICAL_RESOURCE_BLOCKS=true
VITE_CANONICAL_COMPETITION_COURT_ADAPTERS=true
VITE_CANONICAL_COURT_LIVE_RUNTIME=true
```

Then redeploy Preview @ current HEAD and resume 10F STEP2–6 + 10H.

## Safety

| Gate | Value |
| --- | --- |
| PRODUCTION_SQL_APPLIED | NO |
| PRODUCTION_DATA_MUTATIONS | 0 |
| PRODUCTION_ENV_MUTATIONS | 0 |
| PR_438_MERGED | NO |
| PR_438_DRAFT | YES |

## Verdict

`FINAL_VERDICT=BATCH10_BLOCKED_PREVIEW_VITE_CUTOVER_ENV`

`BATCH10_COMPLETE=NO`  
`BATCH11_READY=NO`  
`OWNER_ACTION_REQUIRED=YES` — set five Vercel Preview Vite cutover flags and approve resume of 10F–10H.
