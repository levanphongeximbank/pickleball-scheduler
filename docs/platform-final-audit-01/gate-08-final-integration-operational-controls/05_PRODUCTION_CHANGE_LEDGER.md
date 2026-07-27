# Gate 8 — Production Change Ledger

**Scope:** Changes relevant to Gate 7 security remediation → Gate 8 baseline.  
**Production ref:** `expuvcohlcjzvrrauvud`  
**Gate 8 mutations:** NONE

## Ledger entries

| When (UTC) | Change | Actor / vehicle | Production impact | Evidence |
|------------|--------|-----------------|-------------------|----------|
| 2026-07-27T08:34:07Z | Merge PR #318 Clubs RLS Staging remediation | GitHub merge `df8a1dfb…` | App/docs/tests on main; Staging DB earlier | PR #318 |
| 2026-07-27T08:36:18Z | Vercel Production deploy of `df8a1dfb…` | vercel[bot] deploy `5619485800` | Frontend Production | GitHub Deployments API |
| 2026-07-27T10:22:30Z–10:22:43Z | Clubs RLS Production forward apply + verify | Owner-authorized apply package | `public.clubs` SELECT policy remediated | `docs/clubs-rls-remediation-01/evidence/PRODUCTION_*` |
| 2026-07-27T10:31:08Z | Merge PR #319 Production apply certification | GitHub merge `1c595fc7…` | Evidence on main | PR #319 |
| 2026-07-27T10:33:19Z | Vercel Production deploy of `1c595fc7…` | vercel[bot] deploy `5620947038` success | Live SHA = main tip | Deployments API + status success |
| Gate 8 window | Audit only | Agent Gate 8 | **No DB/env/deploy mutations** | This package |

## Clubs RLS Production post-apply snapshot (committed evidence)

| Check | Value |
|-------|-------|
| Verdict | `CLUBS_RLS_PRODUCTION_APPLY_CERTIFIED` |
| `still_has_broad_status_active` | false |
| `select_policy_count` | 1 |
| `writer_policy_count` | 0 |
| Business data mutations | 0 (apply package claim) |
| B-CLUBS-RLS-01 | RESOLVED |

## Explicit non-entries

- No PITR enablement  
- No restore drill 02  
- No Storage backup enablement  
- No Vercel env edits in Gate 8  

## Marker

`PLATFORM_FINAL_AUDIT_01_GATE_8_PRODUCTION_CHANGE_LEDGER_RECORDED`
