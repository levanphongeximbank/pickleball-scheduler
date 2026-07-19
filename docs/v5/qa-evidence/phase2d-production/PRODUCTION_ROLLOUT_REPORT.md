# Phase 2D — Production Rollout Evidence  
## Transfer President Authorization Gate

**Date:** 2026-07-19  
**Merged main SHA (at apply):** `853fba3a567fbf6bd8706142d6a16b2444f999dd`  
**Implementation commit:** `d8ef55907bb884c9b36a678eb024c2c952b229e0` (ancestor of main)  
**Final verdict:** **PASS_WITHOUT_LIVE_FIXTURE**

---

## Production identity

| Field | Value |
|-------|--------|
| Project ref | `expuvcohlcjzvrrauvud` |
| Host | `https://expuvcohlcjzvrrauvud.supabase.co` |
| Evidence | `scripts/phase42k-production-helpers.mjs`, prior Production rollout reports, `docs/player-management/phase-1e/04_ENVIRONMENT_SAFEGUARDS.md` |
| Not Staging | Staging ref is `qyewbxjsiiyufanzcjcq` — refused by apply script |
| Not Preview/local | Management API scoped exclusively to Production ref |

## SQL

| Field | Value |
|-------|--------|
| File | `docs/v5/phase2d/PHASE_2D_TRANSFER_PRESIDENT_AUTHZ_GATE.sql` |
| Checksum (git blob / LF) | `ea0b3bc6dcead6c749d2562f27f5675ab9ad760e7815a823d4ad273e79c819d8` |
| Rollback | `docs/v5/phase2d/PHASE_2D_TRANSFER_PRESIDENT_AUTHZ_ROLLBACK.sql` |
| Applied | **Yes** — Production only this file |
| Apply timestamp (UTC) | `2026-07-19T16:19:28.190Z` |
| Executor | Supabase Management API (`SUPABASE_ACCESS_TOKEN` present; secret not logged) |
| Objects changed | `public.phase42_can_transfer_president(text)` (create/replace), `public.club_transfer_president(uuid,text,uuid,integer)` (replace body) |

## Staging prerequisite

| Artifact | Status |
|----------|--------|
| `docs/v5/qa-evidence/phase2d-staging/APPLY_REPORT.json` | APPLIED + schema verify PASS |
| Checksum | matches Production approved checksum |

## Owner checklist

1. Production identity — confirmed  
2. Patch on `origin/main` — confirmed (PR #84 / `853fba3`)  
3. SQL path — confirmed  
4. SQL checksum — confirmed  
5. Staging apply PASS — confirmed  
6. Staging schema verify PASS — confirmed  
7. Recovery — Supabase platform PITR + paired rollback SQL  
8. Rollback SQL exists — confirmed  
9. No unrelated migrations — single approved SQL only  
10. Signature compatible — preflight PASS  
11. Broad authz still present pre-apply — confirmed (`phase42_is_tenant_member`)  
12. Patch not already applied — confirmed  

## Preflight / dry-run / apply

| Gate | Result |
|------|--------|
| Preflight | `PREFLIGHT_PASS` — helper absent; bare tenant-member path present; signature/DEFINER/search_path/grants OK |
| Dry-run | `DRY_RUN_PASS` — BEGIN/apply/verify/ROLLBACK; post-dry still `needsPatch` |
| Apply | `APPLIED_VERIFIED` |
| Post-apply | helper exists; transfer uses helper; **no** bare `phase42_is_tenant_member`; audit/OCC/idempotency retained |

Artifacts: `docs/v5/qa-evidence/phase2d-production/`

## Functional verification

| Path | Result |
|------|--------|
| Live Production QA fixture | **Not executed** — no approved isolated Production QA club/accounts; customer governance must not be mutated |
| Schema post-verify | **PASS** |
| Staging schema evidence | **PASS** (prior) |

## Rollback readiness

Apply `docs/v5/phase2d/PHASE_2D_TRANSFER_PRESIDENT_AUTHZ_ROLLBACK.sql` only if authz regression requires restoring the broad path.  
Trigger: post-apply verify fail, or Owner-approved emergency restore of pre-2D transfer authz.  
Do **not** run rollback as part of normal close-out.

## Deploy note

No frontend / Vercel deploy performed. SQL-only Production change.

## Confirmation

No unrelated Production tables truncated. No customer governance assignment rows modified by this rollout. No Production live transfer fixture DML executed in this session.
