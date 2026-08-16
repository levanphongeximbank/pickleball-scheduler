# Batch 10 — Staging Canonical Cutover Acceptance

**Date:** 2026-08-16  
**PR:** #438 (OPEN / DRAFT / UNMERGED)  
**Staging project:** `qyewbxjsiiyufanzcjcq`  
**Production project:** `expuvcohlcjzvrrauvud` (untouched)  
**Resume:** 10F STEP 2 after Owner set five Preview Vite flags

## Baseline

| Field | Value |
| --- | --- |
| HEAD | `aa114f4121db4e01786189e07d77e57af9e92f11` |
| ORIGIN_MAIN | `c8724e4c1d06a5489c4de4a86a29e59970039068` |
| MAIN_IS_ANCESTOR_OF_HEAD | YES |
| PR_STATE | OPEN |
| PR_DRAFT | YES |
| MERGED | NO |

## Preview (bundle evidence — not Dashboard alone)

| Field | Value |
| --- | --- |
| PREVIEW_URL | `https://pickleball-scheduler-git-feat-court-dd7eb3-pickleball-scheduler.vercel.app` |
| Deployment @ HEAD | `https://pickleball-scheduler-298xqyoj3-pickleball-scheduler.vercel.app` (redeploy after flags, 2026-08-16T13:42Z) |
| PREVIEW_BINDS_STAGING | YES (`qyewbxjsiiyufanzcjcq.supabase.co` inlined; prod URL count 0) |
| PREVIEW_CANONICAL_RESERVATION | true |
| PREVIEW_CANONICAL_BOOKING | true |
| PREVIEW_CANONICAL_RESOURCE_BLOCKS | true |
| PREVIEW_CANONICAL_COMPETITION_COURT_ADAPTERS | true |
| PREVIEW_CANONICAL_COURT_LIVE_RUNTIME | true |
| Netlify DP-438 | Do not use |

## Control activation (10F)

| Step | Control | Result |
| --- | --- | --- |
| STEP1 | SQL cutover ON | Remains ON (verified) |
| STEP2 | JS reservation path | Preview flag true + activation smoke PASS |
| STEP3 | Booking canonical | Preview flag true + backend/browser PASS |
| STEP4 | Resource Blocks | Preview flag true + backend/browser PASS |
| STEP5 | Competition Adapter B | Preview flag true + Head A reserve/release PASS |
| STEP6 | Court Live Runtime | Preview flag true + NOW states PASS |

`CANONICAL_BACKEND_STAGING=PASS`  
`CANONICAL_ON_LEGACY_AUTHORITY_HOPS=0`  
Cross-module pairs 15/15; idempotency/tenant/club access PASS (activation smoke + backend cert).

## Real-browser Staging acceptance

Artifact: `artifacts/batch10-browser-acceptance/browser-acceptance-1786889616695.json`  
Actor: `owner@staging.local` on Vercel Preview → Staging.

| Gate | Result |
| --- | --- |
| COURT_INVENTORY_REAL_BROWSER | PASS (2 physical courts, native UUIDs) |
| BOOKING_REAL_BROWSER | PASS (create/reschedule/transfer conflict preserves court/transfer/cancel/release) |
| RESOURCE_BLOCK_REAL_BROWSER | PASS (MAINTENANCE create, booking overlap rejected, cancel releases) |
| COURT_STATUS_REAL_BROWSER | PASS (AVAILABLE / UNAVAILABLE_NOW / OUT_OF_SERVICE_NOW) |
| DAILY_REAL_BROWSER | PASS |
| INTERNAL_REAL_BROWSER | PASS |
| OFFICIAL_REAL_BROWSER | PASS |
| TEAM_REAL_BROWSER | PASS |
| CROSS_MODULE_CONFLICT_REAL_BROWSER | PASS (Booking↔Block, Booking↔Competition) |
| REFEREE_RUNTIME_STAGING_REGRESSION | PASS (`/referee`) |
| COURT_CUTOVER_REFEREE_BROWSER_REGRESSION | PASS |

**UI GAP:** CLOSED — `MaintenanceBookingPanel` exposes block-type selector for **MAINTENANCE** and **OPERATIONAL_BLOCK**, plus list/reschedule/transfer/cancel on the same canonical Resource Block lifecycle.

### Observability

| Gate | Value |
| --- | --- |
| BROWSER_CONSOLE_ERRORS | 0 |
| BROWSER_NETWORK_ERRORS (court_* RPC) | 0 |
| RAW_SQL_ERROR_LEAK_COUNT | 0 |
| PRODUCTION_REQUESTS | 0 |

Unrelated Staging noise (notification_inbox / billing) observed and excluded from court RPC network gate.

## Functional rollback rehearsal

| Gate | Value |
| --- | --- |
| FUNCTIONAL_ROLLBACK_TO_OFF | PASS — SQL OFF + activation smoke `expectOff` PASS |
| LEGACY_OFF_PATH_SMOKE | PASS |
| RESTORE_CANONICAL_ON_AFTER_ROLLBACK | PASS — SQL ON + activation smoke `expectOn` PASS |
| VITE_PREVIEW_FLAG_TOGGLE_REHEARSAL | SKIPPED — no `VERCEL_TOKEN` in agent env; Owner-set five Preview flags left true; re-verified in bundle after SQL restore |

## Fixture cleanup

`UNINTENDED_FIXTURE_ROWS_REMAINING=0` for `COURT_BATCH10_CERT_*` (reservations/bookings/blocks/commands).

## Final regressions

| Gate | Value |
| --- | --- |
| BATCH9_RECERTIFICATION | PASS (activation smoke / backend cert) |
| ARCHITECTURE_LOCKS | PASS (`ci:foundation-lock`) |
| LINT_NO_NEW | PASS |
| BUILD | PASS |
| FULL_UNIT | PASS (8169 tests, 8147 pass, 0 fail, 22 skipped) |
| Pre-Batch10 identity guard + Batch8/9 + Referee Adapter B subset | PASS |

## Safety

| Gate | Value |
| --- | --- |
| STAGING_MUTATIONS | YES (SQL cutover toggle + cert/browser fixtures; cleaned) |
| PRODUCTION_MUTATIONS | 0 |
| PRODUCTION_SQL_APPLIED | NO |
| PR_438_MERGED | NO |
| PR_438_DRAFT | YES |

## Phase C — restore canonical ON_ON (2026-08-16T17:12Z resume → 17:17Z complete)

Owner redeployed PR #438 Preview with all 5 Vite flags true. Git-branch alias verified **before** SQL mutation.

| Field | Value |
| --- | --- |
| HEAD / PR #438 | `aa114f4121db4e01786189e07d77e57af9e92f11` (OPEN / DRAFT / UNMERGED) |
| ORIGIN_MAIN | `c8724e4c1d06a5489c4de4a86a29e59970039068` (ancestor of HEAD) |
| PREVIEW_URL (alias) | `https://pickleball-scheduler-git-feat-court-dd7eb3-pickleball-scheduler.vercel.app` |
| Alias index | `/assets/index-BM2tTuEu.js` |
| Unique redeploy @ HEAD | `https://pickleball-scheduler-88lhv9474-pickleball-scheduler.vercel.app` (2026-08-16T17:05:39Z) |
| PREVIEW_ALL_5_FLAGS_TRUE | **YES** (`trueHitTotal=45`, `falseHitTotal=0`) |
| PREVIEW_BINDS_STAGING | YES (`qyewbxjsiiyufanzcjcq.supabase.co` count 9; prod URL count 0) |
| SQL_RESERVATION_CUTOVER | **true** (`false → true` at 2026-08-16T17:12:11.025Z) |
| FULL_COURT_CUTOVER_STATE | `ON_ON` |
| Staging fingerprint | `18` / `18adb561c4da598fd3f9e2c3bc08e63a` (post-rehearsal baseline restored) |
| PRODUCTION_MUTATIONS | 0 (Production has no `court_resource_*` tables) |

### Phase C gates

| Gate | Result |
| --- | --- |
| COURT_INVENTORY_CANONICAL_SMOKE | PASS |
| BOOKING_CANONICAL_SMOKE | PASS |
| RESOURCE_BLOCK_CANONICAL_SMOKE | PASS |
| COURT_STATUS_CANONICAL_SMOKE | PASS |
| DAILY_CANONICAL_SMOKE | PASS |
| INTERNAL_CANONICAL_SMOKE | PASS |
| OFFICIAL_CANONICAL_SMOKE | PASS |
| TEAM_CANONICAL_SMOKE | PASS |
| REFEREE_RUNTIME_UNCHANGED | PASS |
| CANONICAL_ON_LEGACY_AUTHORITY_HOPS | 0 |
| BROWSER_CONSOLE_ERRORS | 0 |
| BROWSER_NETWORK_ERRORS | 0 |
| RAW_SQL_ERROR_LEAK_COUNT | 0 |
| DATA_CORRUPTION_COUNT | 0 |
| STAGING_REAL_BROWSER_ACCEPTED | PASS |

Artifacts:
- `artifacts/batch10-browser-acceptance/restore-phase-c-on-on-1786900660780.json`
- `artifacts/batch10-browser-acceptance/browser-acceptance-1786900566994.json`

## Verdict

`FINAL_VERDICT=BATCH10_PASS_STAGING_CANONICAL_RUNTIME`

| Gate | Value |
| --- | --- |
| PHASE_A_OFF_PATH | PASS — `artifacts/batch10-browser-acceptance/rollback-phase-a-off-path-1786893513777.json` |
| PHASE_B_FULL_OFF_OFF | PASS — `artifacts/batch10-browser-acceptance/rollback-phase-b-off-off-1786894530134.json` |
| FUNCTIONAL_ROLLBACK_TO_OFF | PASS |
| RESTORE_CANONICAL_ON_AFTER_ROLLBACK | PASS — `artifacts/batch10-browser-acceptance/restore-phase-c-on-on-1786900660780.json` |
| PREVIEW_ALL_5_FLAGS_TRUE | YES |
| SQL_RESERVATION_CUTOVER | true |
| FULL_COURT_CUTOVER_STATE | ON_ON |
| STAGING_CANONICAL_RUNTIME | PASS |
| STAGING_REAL_BROWSER_ACCEPTED | YES — `artifacts/batch10-browser-acceptance/browser-acceptance-1786900566994.json` |
| CANONICAL_ON_LEGACY_AUTHORITY_HOPS | 0 |
| DATA_CORRUPTION_COUNT | 0 |
| PRODUCTION_MUTATIONS | 0 |
| OPERATIONAL_BLOCK_UI_GAP | CLOSED |

`BATCH10_COMPLETE=YES`  
`BATCH11_READY=NO` (explicit stop — do not start)  
`STAGING_CANONICAL_RUNTIME=ON_ON`  
`FINAL_STAGING_CANONICAL_STATE=SQL_ON+ALL_5_PREVIEW_FLAGS_TRUE`  
`ALL_STAGING_COURT_CANONICAL_CONTROLS_ON=YES`

`OWNER_ACTION_REQUIRED=NO`

**STOP.** Do not start Batch11. Do not mark PR ready. Do not merge PR #438. Do not apply Production.
