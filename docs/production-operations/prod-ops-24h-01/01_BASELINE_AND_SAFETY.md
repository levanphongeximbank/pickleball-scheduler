# PROD-OPS-24H-01 — Baseline and Safety

**Workstream:** Production Web Continuity — First 24 Hours Operational Verification  
**Nature:** Evidence-driven, read-only. No remediation unless separately authorized.  
**Observed window start (UTC):** `2026-07-27T15:52:00Z` (approx. worktree create)  
**Parent decision:** `PLATFORM-FINAL-AUDIT-01` → `GO_WITH_CONDITIONS` / `PLATFORM_FINAL_AUDIT_01_CLOSED_WITH_CONDITIONS`  
**Operational mode (inherited):** `CONSTRAINED_PRODUCTION_WEB_CONTINUITY`

## Fresh origin/main

| Field | Value |
|-------|-------|
| Fetch | `git fetch origin main` |
| `origin/main` full SHA | `edca457748be3ef3a160b68076a69535b2ab6e3f` |
| Tip subject | Merge pull request #322 — Gate 10 final release decision |
| Audit closure merge verified | **YES** — exact match to required SHA `edca457748be3ef3a160b68076a69535b2ab6e3f` |

## Worktree / branch

| Field | Value |
|-------|-------|
| Worktree | `C:\Users\Le Phong\PICK_VN-Workstreams\prod-ops-24h-01` |
| Branch | `feature/prod-ops-24h-01` |
| Created from | `origin/main` @ `edca4577…` |
| Base repository (primary tree) | Clean relative to this workstream start (local `main` was behind; worktree uses fresh tip) |
| Worktree porcelain at baseline | Empty (clean) |

## Package / lock hashes (SHA256)

| File | SHA256 |
|------|--------|
| `package.json` | `CF0361BF8FC7F4AE6AA39587AB8489F4C1D3489C04B2E980EEC8E6EB396AFE0E` |
| `package-lock.json` | `844840CA58B3EADCC4A1D090ABDCFCD057B7562F48BB1450D4A8AD1A1763B448` |

Hashes **match** Gate 10 recorded values. No package/lock content changes in this workstream.

## Production deployment evidence (baseline)

| Field | Value |
|-------|-------|
| GitHub Production deployment ID | `5625433697` |
| Deployed SHA | `edca457748be3ef3a160b68076a69535b2ab6e3f` |
| Status | `success` (GitHub Deployments API) |
| Vercel deployment URL | `https://pickleball-scheduler-6aj80ow4e-pickleball-scheduler.vercel.app` |
| Vercel deployment id | `dpl_BtBXTnatJxCYxLs4ipmrUSUAxTu8` |
| Target | `production` / Ready |
| Alias | `https://pickvn.app` (and project aliases) |
| Created (UTC) | `2026-07-27T15:44:11Z` |

## Mutation baseline (agent)

| Action | Status |
|--------|--------|
| Supabase Production modify | **NONE** |
| Supabase Staging modify | **NONE** |
| SQL writes | **NONE** |
| Schema / policy / grant / function / data changes | **NONE** |
| Vercel env changes | **NONE** |
| Production deploy by agent | **NONE** (observed auto-deploy of Gate 10 merge only) |
| PITR enable | **NONE** |
| Recovery project delete | **NONE** |
| Secrets printed | **NONE** |
| Production test users created | **NONE** |
| Business record mutations | **NONE** |
| Force-push / reset / rebase / git clean | **NONE** |
| PR merge by agent | **NONE** |

## Known conditions preserved exactly

```text
B-AUDIT-TRACEABILITY-01=PARTIALLY_RESOLVED
PITR declined by Owner / PITR=NOT_ENABLED
STORAGE_OBJECT_RECOVERY=NOT_COVERED
RESTORE_DRILL_02=DEFERRED
LATEST_SCHEMA_RECOVERABILITY=NOT_VERIFIED
Latest Clubs RLS recoverability=NOT_VERIFIED
Vercel Production environment values=UNREADABLE
effective VITE_RBAC_ENABLED=NOT_VERIFIED
monitoring operational effectiveness=NOT_VERIFIED
Ecosystem providers/webhooks=ABSENT
mobile store release=NOT_APPROVED
```

## Marker

`PROD_OPS_24H_01_BASELINE_AND_SAFETY_RECORDED`
