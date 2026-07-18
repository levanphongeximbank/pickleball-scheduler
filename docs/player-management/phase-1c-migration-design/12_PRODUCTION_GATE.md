# 12 — Production Gate

Production apply only when **all** are true:

| # | Gate |
|---|------|
| 1 | Staging apply **PASS** |
| 2 | RLS verification **PASS** |
| 3 | Backfill verification **PASS** |
| 4 | No Phase 1B/1C regressions |
| 5 | Staging rollback drill **PASS** |
| 6 | Owner written approval |
| 7 | Exact Production project ref confirmed |
| 8 | Backup / restore strategy confirmed |
| 9 | Post-deploy checklist prepared (schema, sample self-update, monitoring) |
| 10 | App durable repo wired behind flag with kill-switch |

**Forbidden:** apply from this design branch without a separate SQL implementation + Staging PASS package.
