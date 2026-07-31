# Phase 5 Ordered Runbook Draft (NOT EXECUTED)

**Status:** DRAFT for Owner review — resolves document conflict.  
**Decision context:** Phase 5A readiness = `BLOCKED_PHASE5_READINESS` until backup/PITR/restore is proven and Owner accepts this runbook as SSOT.  
**Do not issue:** `PLATFORM_HARD_CUTOVER_01_PHASE_05_COMPLETE` from this draft alone.

## Document conflict resolution

| Source | Says | Classification |
|--------|------|----------------|
| `phase-04/PRODUCTION_CUTOVER_PLAN.md` | Apply migrations **M1→M8** | **Stale / incomplete** |
| `phase-04/staging-rehearsal/STAGING_REHEARSAL_PLAN.md` | Apply **M1→M8** | **Stale relative to manifest** |
| `phase-04/manifests/MIGRATION_MANIFEST.md` | Apply order **M0→M11** | **Canonical SSOT** |

**Rule for Phase 5 execution:** use **M0→M11** from `MIGRATION_MANIFEST.md`.  
`PRODUCTION_CUTOVER_PLAN.md` step “Apply migrations M1→M8” must be treated as superseded by this draft once Owner accepts.

## Preconditions (hard stop if any fail)

1. Fresh `origin/main` / Production SPA SHA agreed for cutover window.
2. Production project_ref verified = `expuvcohlcjzvrrauvud` (never Staging `qyewbxjsiiyufanzcjcq`).
3. **Production backup usable + restore entry proven** (dashboard physical and/or PITR). If not provable → **STOP** (`BLOCKED`).
4. Identity preserve precheck PASS (`00_IDENTITY_PRESERVE_PRECHECK.sql`).
5. Protected guards PASS (`01_PROTECTED_OBJECT_GUARDS.sql`).
6. Owner GO recorded per family or batched GO with explicit family list.

## Ordered execution (Production — Owner GO)

| Step | Action | Exact package | Stop / rollback point |
|-----:|--------|---------------|------------------------|
| 0 | Confirm backup/restore | Owner dashboard evidence (no secrets in git) | STOP if not proven |
| 1 | Identity + guards | `sql/destructive/00_*`, `01_*` | STOP if FAIL |
| 2 | **M0** verify-only if already locked | `docs/production-security/prod-sec-g3-b12-01/` | Leave locked; do not reopen |
| 3 | **M1** Customer | `docs/customer-management/phase-3/10..50_*.sql` | `90_*.sql` |
| 4 | **M2** Finance | `docs/supabase-finance-phase1f.sql` | finance rollback SQL |
| 5 | **M3** CRM | `docs/crm/phase-1g` + `phase-1h` | CRM rollback SQL |
| 6 | **M4** Reporting | `docs/reporting-analytics/reporting-02/` | `90/91_*.sql` |
| 7 | **M5** News | news-02/03/04 packages | `90_*.sql` |
| 8 | **M6** Coaching | coaching-02 + coaching-04 | `90_*.sql` |
| 9 | **M7** Competition Core cc02 | `docs/competition-core/supabase-cc02*.sql` | recreate / Owner emergency |
| 10 | **M8** Competition Remote SSOT | `phase-04/sql/m8-competition-remote-ssot/10..50_*.sql` — **`tenant_id`/`p_tenant_id` = text** | `90_ROLLBACK.sql` |
| 11 | **M9** TT remainder | Promote Staging `phase_tt2*..tt6b_*` — **do not invent** | partial stop |
| 12 | **M10** Referee V5 | Promote Staging `phase_v5a_referee*`, `phase_v5d*` — **do not invent** | partial stop |
| 13 | **M11** Pairing digest | Promote Staging `private_pairing_pr4_digest_patch` | stop patch; keep RC1 |
| 14 | Ordered wipe | `sql/destructive/10_ORDERED_WIPE.sql` | restore from proven backup |
| 15 | DROP `club_ai_data` | `sql/destructive/20_DROP_CLUB_AI_DATA.sql` | only if safe recreate pack exists **or** Owner accepts permanent DROP |
| 16 | Post wipe verify | `sql/destructive/30_POST_WIPE_VERIFY.sql` | STOP / restore if FAIL |
| 17 | Redeploy Production SPA | Owner Vercel only | prior Ready deployment |
| 18 | Enable flags (Owner GO) | `VITE_PLATFORM_HARD_CUTOVER_ENABLED`, `VITE_COMPETITION_REMOTE_SSOT_ENABLED`, optional `VITE_PICK_VN_RATING_V5_ENABLED` | flags OFF soft-rollback |
| 19 | Reseed 01–17 + 99 | `sql/reseed/` | re-run verify; restore if catastrophic |
| 20 | Production Operator Acceptance | Runner after cutover only | do not run in 5A |
| 21 | Marker | `PLATFORM_HARD_CUTOVER_01_PHASE_05_COMPLETE` | only when all green |

## Production baseline notes (Phase 5A read-only)

- **M0:** already present and verified on Production.
- **M1–M8:** missing on Production (M8 authored in repo, not applied).
- **M9:** partially present (TT P1/TT1B); remainder needs promote.
- **M10:** missing (legacy referee token RPCs only).
- **M11:** RC1 present; digest patch missing.
- **Wipe impact (sanitized):** 86/92 wipe targets present; **1119** rows across present wipe targets; 6 absent tables; protected objects not in wipe list; `club_ai_data` is DROP-only (0 rows).

## Explicit non-goals of Phase 5A

- No Production/Staging SQL apply, wipe, DROP, reseed, backup create/restore, flag change, deploy, or Operator Runner.
