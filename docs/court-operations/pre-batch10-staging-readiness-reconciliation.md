# Pre-Batch10 — Staging Readiness Reconciliation Gate

**NOT BATCH10. NOT A STAGING CUTOVER.**

```
STAGING_SQL_APPLIED=NO
PRODUCTION_SQL_APPLIED=NO
REAL_BROWSER_STAGING=NO
PR=438 (OPEN, DRAFT, UNMERGED)
```

## Gate purpose

1. Reconcile PR #438 with latest `origin/main` (includes PR #439 Referee Adapter B)
2. Preserve Referee canonical runtime from #439
3. Close Phase3A identity_guard tenant-vs-venue debt
4. Recertify Batch1–9 on reconciled head
5. Decide whether Batch10 Staging may start

## Identity guard debt closed

| Field | Value |
| ----- | ----- |
| OBJECT_NAME | `public.court_resource_identity_guard()` |
| OBJECT_TYPE | TRIGGER FUNCTION |
| OLD_GUARD_SEMANTICS | `physicalCourt.tenant_id` compared to `court_clusters.venue_id` |
| NEW_GUARD_SEMANTICS | `physicalCourt.tenant_id` compared to `court_clusters.tenant_id` |
| PACKAGE | `docs/v5/migrations/court-operations-pre-staging-identity-guard-01/` |

Phase3A certified SQL files are **unchanged**. Correction is additive `CREATE OR REPLACE` only.

## Dependency order (future Staging — not applied here)

```
Phase3A → Phase3B → D4 → Batch1 → Batch2 → Batch3 → Batch4 → Batch7 → Batch8
  → court-operations-pre-staging-identity-guard-01
```

## ROLLBACK_DEPENDENCY

Rolling back the identity-guard correction while keeping Batch8 distinct
tenant/venue semantics is **unsafe**. Rollback of this package requires
immediate Batch8 rollback (or collapse of tenant invent to venue_id).
