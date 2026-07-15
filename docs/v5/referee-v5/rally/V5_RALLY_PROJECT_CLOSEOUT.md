# Referee V5 Rally Scoring — Project Closeout

**Date:** 2026-07-15
**Scope closed:** R2-1 → R2-2G (USAP 2026 Provisional Rally Doubles + Team Tournament integration)

---

## Status summary

| Track | Status |
|-------|--------|
| Rally development (R2-1 → R2-2G) | **COMPLETE** |
| Staging verification | **GO** |
| Team Tournament integration (R2-2G) | **COMPLETE** |
| Branch integration into `feature/competition-core-standardization` | **COMPLETE** (merge `24392f5`) |
| Production readiness | **NO-GO / DEFERRED** |
| Production rollout | **NOT PERFORMED** |

## What shipped into the development branch

- Scoring Strategy Registry (R2-1) and USAP 2026 Provisional Rally Doubles strategy.
- Rally UI presentation (scoreboard, serve context, court visualizer) — flag-gated.
- Replay / Undo / Snapshot integrity for Rally.
- Persistence + Edge Runtime parity for Rally.
- Team Tournament Rally integration: config hierarchy, provision mapping (P0-06 fix), legacy scoring lock, official result consumer, standings update, best-of behavior, correction revision.
- Staging QA evidence (R2-2F, R2-2G) and rollback SQL.

## Merge integration facts

- Merge branch: `merge/referee-v5-rally-integration`
- Merge commit: `24392f56831d65afbd7da1022d6a430a05033248` (parents `0dd5238` + `0c090a9`)
- Regression: full unit 2382/2382, Referee V5 238/238, Rally 128/128, Team Tournament 147/147, standings 319/319, perf 3/3, build PASS, lint PASS, secret scan CLEAN, Edge bundle FRESH.
- UI: 1 failed test + 3 failed suites are pre-existing on the target baseline (proven), not merge regressions.

## Production readiness — remaining prerequisites (why NO-GO)

Rally must stay **OFF** in Production until these are completed and signed off:

1. **Feature flag governance** — confirm `VITE_TT5_REFEREE_V5_RALLY_ENABLED` remains OFF across all Production/Preview environments; document controlled enablement procedure.
2. **Production SQL** — `docs/v5/team-tournament/tt5/R2-2G_PROVISION_MAP.sql` must be reviewed and applied to Production via a gated migration process (currently staging-only, guarded against Production project ref). Not yet applied.
3. **Production Edge deploy** — the shared Referee V5 Edge bundle must be deployed to Production Edge (not yet deployed).
4. **Best-of live scoring** — best-of Rally live scoring flow (beyond finalized-result consumption) needs full end-to-end coverage before Production enablement.
5. **Client/Edge flag parity** — verify no asymmetry between client and Edge flag reads in Production.
6. **Production QA pass** — full Production-environment QA of the TT → V5 Rally → finalize → consumer → standings flow with duplicate/correction delivery.

## Rollback

- Revert merge: `git revert -m 1 24392f56831d65afbd7da1022d6a430a05033248`
- Keep `VITE_TT5_REFEREE_V5_RALLY_ENABLED` OFF.
- Edge Production: no rollback needed (never deployed).
- Production SQL: no rollback needed (never applied); `R2-2G_ROLLBACK.sql` available for staging.

---

**Production:** UNTOUCHED
**SQL:** NOT APPLIED TO PRODUCTION
**Deployment:** NOT PERFORMED TO PRODUCTION

Stop point: merge + reports complete. No new phase started. Awaiting owner review before any Production activity.
