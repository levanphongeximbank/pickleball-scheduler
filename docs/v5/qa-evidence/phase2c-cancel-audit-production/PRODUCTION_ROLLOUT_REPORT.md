# Phase 2C Cancel Audit — Production Rollout Evidence

**Date:** 2026-07-19  
**Merged main SHA (at apply):** `96889bda132e9e3383061738b347958ece6a9652`  
**Patch commit:** `2ed296293e90d1894b81ea10b1fd508c83a0fad8`  
**Final verdict:** **PASS_WITHOUT_LIVE_FIXTURE**

---

## Production identity

| Field | Value |
|-------|--------|
| Project ref | `expuvcohlcjzvrrauvud` |
| Host | `https://expuvcohlcjzvrrauvud.supabase.co` |
| Evidence | `scripts/phase42k-production-helpers.mjs`, `docs/v5/GATE_3_PRODUCTION_RUNTIME_PREFLIGHT.md`, `docs/v5/V5_SAAS_COMPLETION_ROADMAP.md` |
| Not Staging | Staging ref is `qyewbxjsiiyufanzcjcq` — refused by apply script |
| Not Preview/local | Management API scoped exclusively to Production ref |

## SQL

| Field | Value |
|-------|--------|
| File | `docs/v5/phase2c-cancel-audit/PHASE_2C_CANCEL_MEMBERSHIP_REQUEST_AUDIT.sql` |
| Checksum (git blob / LF) | `ee4f671b0ae55b892b78a593fd97e3044bcf11e56989b971a29b2bca7360110f` |
| Applied | **Yes** — Production only this file |
| Apply timestamp (UTC) | `2026-07-19T14:59:39.418Z` |
| Executor | Supabase Management API (`SUPABASE_ACCESS_TOKEN` present; secret not logged) |

## Staging prerequisite

| Artifact | Status |
|----------|--------|
| `docs/v5/qa-evidence/phase2c-cancel-audit-staging/APPLY_REPORT.json` | APPLIED |
| `VERIFY_REPORT.json` | PASS |
| `FIXTURE_REPORT.json` | PASS (live cancel + 1 audit + idempotent replay) |

## Owner checklist

1. Production identity — confirmed  
2. SQL path — confirmed  
3. SQL checksum — confirmed  
4. Patch on `origin/main` — confirmed (ancestor of `96889bd`)  
5. Staging PASS — confirmed  
6. Recovery — Supabase platform PITR + `PHASE_2C_CANCEL_MEMBERSHIP_REQUEST_AUDIT_ROLLBACK.sql`  
7. Rollback procedure — documented  
8. No unrelated migrations — single approved SQL only  
9. Function compatible — preflight PASS  
10. Constraint compatible — preflight PASS  

## Preflight / dry-run / apply

| Gate | Result |
|------|--------|
| Preflight | `PREFLIGHT_PASS` — cancel not yet present; signature/DEFINER/search_path OK |
| Dry-run | `PASS` |
| Apply | `APPLIED_VERIFIED` |
| Post-apply schema | cancel action whitelisted; RPC emits `phase42_write_audit('club.membership_request.cancel', …)` |

Artifacts: `docs/v5/qa-evidence/phase2c-cancel-audit-production/`

## Functional verification

| Path | Result |
|------|--------|
| Live Production QA fixture | **Not executed** — Production app env (`VITE_SUPABASE_URL` / anon) unavailable in this runner for approved QA profile lookup |
| Schema post-verify | **PASS** (equivalent to Staging schema verify) |
| Staging live fixture | **PASS** (prior evidence retained) |

## Rollback readiness

Apply `docs/v5/phase2c-cancel-audit/PHASE_2C_CANCEL_MEMBERSHIP_REQUEST_AUDIT_ROLLBACK.sql` to restore pre-audit RPC body.  
Allow-list retention of `club.membership_request.cancel` is harmless.

## Deploy note

No frontend / Vercel deploy performed. SQL-only Production change.

## Confirmation

No unrelated Production tables truncated or customer rows modified by this rollout. No Production live cancel fixture DML executed in this session.
