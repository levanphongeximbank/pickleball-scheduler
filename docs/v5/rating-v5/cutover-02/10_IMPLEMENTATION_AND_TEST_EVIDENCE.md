# CUTOVER-02 — Implementation & Test Evidence

## Implementation summary

| Area | Path |
|------|------|
| Dual-read boundary | `src/features/player-rating/cutover-02/dual-read/` |
| Writer freeze | `src/features/player-rating/cutover-02/writer-freeze/` |
| Flags / deny | `src/features/player-rating/cutover-02/config/` |
| RPC client hook | `src/features/pick-vn-rating/services/pickVnRatingRpcService.js` |
| SQL (author only) | `docs/v5/rating-v5/cutover-02/sql/RATING_V5_CUTOVER_02_STAGING_WRITER_FREEZE_GUARD.sql` |
| Focused tests | `tests/rating-v5-cutover-02-dual-read-writer-freeze.test.js` |
| A3c fixture prep | `src/features/player-rating/cutover-02/fixture-prep/` |
| A3c SQL (author only) | `docs/v5/rating-v5/cutover-02/sql/RATING_V5_CUTOVER_02_A3C_FIXTURE_PREP.sql` |
| A3c docs | `docs/v5/rating-v5/cutover-02/11_A3C_CONTROLLED_STAGING_FIXTURE_PREP.md` |
| A3c focused tests | `tests/rating-v5-cutover-02-a3c-fixture-prep.test.js` |

## Feature flags (default OFF)

| Flag | Purpose |
|------|---------|
| `VITE_RATING_V5_DUAL_READ_COMPARE_ENABLED` | Dual-read observe |
| `VITE_RATING_V5_WRITER_FREEZE_MODE` | `OFF` \| `OBSERVE` \| `ENFORCE` |
| `VITE_RATING_V5_DUAL_READ_COHORT` | CSV player ids |
| `VITE_RATING_V5_DUAL_READ_SAMPLE_RATE` | 0–1 |
| `VITE_RATING_V5_CUTOVER_02_TENANT_ALLOWLIST` | CSV tenants |
| `VITE_RATING_V5_SCALE_MAPPING_STATUS` | default `UNAPPROVED` |
| `VITE_RATING_V5_SCALE_MAPPING_STRATEGY` | default `RAW_ONLY` |
| `VITE_RATING_V5_CUTOVER_02_FIXTURE_PREP_ENABLED` | A3c fixture prep (default OFF) |

## Safety counters (this workstream package)

```text
DATABASE_WRITES=0
STAGING_MUTATIONS=0
PRODUCTION_MUTATIONS=0
SQL_EXECUTION=0
FEATURE_FLAG_RUNTIME_CHANGES=0
MANUAL_DEPLOYMENTS=0
PRODUCTION_PUBLISHED_READER_CHANGES=0
PRODUCTION_WRITER_FREEZE=0
```

## Test coverage map

Assertions 1–24 in focused test file map 1:1 to workstream §11 requirements.

## CUTOVER-01 audit delta

See `10_CUTOVER_01_AUDIT_DELTA.md`.
