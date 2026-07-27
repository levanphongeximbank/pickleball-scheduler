# PROD-OPS-30D-01 — Baseline and Safety

**Workstream:** Thirty-Day Controlled Production Operations, Monitoring & Recovery Closure  
**Nature:** Evidence-driven, read-only by default. Restore drill 02 not executed in this package.  
**Parent:** `PLATFORM-FINAL-AUDIT-01` → `CLOSED_WITH_CONDITIONS`  
**Prior ops:** `PROD-OPS-24H-01` CLOSED; `PROD-OPS-7D-01` CLOSED  
**Operating mode (inherited):** `CONTINUE_CONSTRAINED_PRODUCTION`  
**7D verdict (preserved):** `PROD_OPS_7D_PASS_WITH_OBSERVATIONS`

## Fresh origin/main

| Field | Value |
|-------|-------|
| Fetch | `git fetch origin main` |
| `origin/main` full SHA | `6eff4c61496734a418ce6a534fbdaf7bd3b10368` |
| Tip subject | Merge pull request #324 — PROD-OPS-7D-01 |
| PR #324 merge commit verified | **YES** — exact match |

## PROD-OPS-7D final markers (verified)

| Marker | Status |
|--------|--------|
| `PROD_OPS_7D_01_OPERATIONAL_CONTROLS_COMPLETE` | On main package |
| `PROD_OPS_7D_PASS_WITH_OBSERVATIONS` | Preserved |
| `PROD_OPS_7D_01_POST_MERGE_VERIFIED` | Parent post-merge session + merge on main |
| `PROD_OPS_7D_01_POST_MERGE_CLEANUP_VERIFIED` | Parent post-merge cleanup complete |
| `PROD_OPS_7D_01_CLOSED` | Parent state |

## Worktree / branch

| Field | Value |
|-------|-------|
| Worktree | `C:\Users\Le Phong\PICK_VN-Workstreams\prod-ops-30d-01` |
| Branch | `feature/prod-ops-30d-01` |
| Created from | `origin/main` @ `6eff4c61…` |
| Worktree porcelain at baseline | Empty (clean) |

## Package / lock hashes (SHA256)

| File | SHA256 |
|------|--------|
| `package.json` | `CF0361BF8FC7F4AE6AA39587AB8489F4C1D3489C04B2E980EEC8E6EB396AFE0E` |
| `package-lock.json` | `844840CA58B3EADCC4A1D090ABDCFCD057B7562F48BB1450D4A8AD1A1763B448` |

Hashes **match** PROD-OPS-7D / 24H / Gate 10. No package/lock content changes intended.

## Current Production deployment (baseline)

| Field | Value |
|-------|-------|
| Deploy ID | `5631492629` |
| Deployed SHA | `6eff4c61496734a418ce6a534fbdaf7bd3b10368` |
| Status | success / Ready |
| Alias | `https://pickvn.app` |
| Created (UTC) | `2026-07-27T23:23:45Z` |
| Source ↔ Production tip | **PASS** — equals fresh `origin/main` |

Prior recorded tips (parity chain): `5625433697`/`edca4577…` (Gate 10); `5626047618`/`f52cfbf8…` (24H merge).

## Mutation baseline (agent)

| Action | Status |
|--------|--------|
| Supabase Production / Staging modify | **NONE** |
| SQL writes / schema / policy / data changes | **NONE** |
| Vercel env changes | **NONE** |
| Production deploy by agent | **NONE** (observed auto-deploy of PR #324 only) |
| PITR enable / recovery project create-delete | **NONE** |
| Secrets printed | **NONE** |
| Production users / business mutations | **NONE** |
| Force-push / reset / rebase / git clean | **NONE** |
| PR merge by agent | **NONE** |

## Known open conditions (preserve exactly)

```text
A-CAL-01 seven-calendar-day route series incomplete
full Vercel Production environment inventory unreadable
interactive login not fully exercised
monitoring operational effectiveness only partially verified
PITR=NOT_ENABLED
Storage recovery GAP
RESTORE_DRILL_02=DEFERRED
LATEST_SCHEMA_RECOVERABILITY=NOT_VERIFIED
latest Clubs RLS recoverability=NOT_VERIFIED
Tournaments=LIVE_EMPTY
Rankings=LIVE_EMPTY
whole-platform GA=NOT_APPROVED
Competition Engine full Production rollout=NOT_APPROVED
Business Modules full Production rollout=NOT_APPROVED
Intelligence & Analytics full Production rollout=NOT_APPROVED
Ecosystem live activation=NOT_APPROVED
iOS App Store release=NOT_APPROVED
Android Play Store release=NOT_APPROVED
```

## Marker

`PROD_OPS_30D_01_BASELINE_AND_SAFETY_RECORDED`
