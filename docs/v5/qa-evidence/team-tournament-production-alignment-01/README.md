# team-tournament-production-alignment-01 evidence

Package authoring only. No Staging apply. No Production apply.

## Production read-only prestate (2026-08-14)

- Project: `expuvcohlcjzvrrauvud`
- `team_tournaments` count: **82**
- `canonical_tournaments` where `mode='team_tournament'`: **0**
- `team_tournament_create`: **ABSENT**
- PR #423 referee foundation tables/RPCs: **PRESENT**
- Classification: **C** — PRESENT=41 MISSING=33 DRIFTED=7 of 74 required lifecycle objects

## Local real Postgres

See `LOCAL_REAL_POSTGRES_RESULTS.md`. Opted-in harness **PASS** on disposable embedded PostgreSQL 16.4 (2026-08-14).

## Safety

- STAGING_MUTATIONS=0
- PRODUCTION_SQL_MUTATIONS=0
- PRODUCTION_DATA_MUTATIONS=0
