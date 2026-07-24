# I&A-03 — Analytics Query and Projection Runtime

## Certification status

| Field | Value |
| --- | --- |
| Workstream | I&A-03 |
| Slice | Analytics Query and Projection Runtime |
| Module home | `src/features/intelligence-analytics/runtime` |
| Baseline | fresh `origin/main` (extends merged I&A-01 + I&A-02) |
| Platform Core | CLOSED — not modified |
| Competition E2E | not depended upon |
| SQL / migration / Supabase write | none |
| Dashboard / route changes | none |
| Module-specific adapters | none (deferred) |

## Decision

I&A-01 provides immutable query descriptors, results, and deterministic
aggregation over explicit numeric input. I&A-02 provides registry governance
and exact metric ID/version lookup. Neither provides a query execution
boundary, source adapter contract, or projection pipeline.

No equivalent canonical runtime existed on `origin/main`. Therefore I&A-03 adds
a module-neutral read-only query/projection runtime under
`src/features/intelligence-analytics/runtime/**`, composing I&A-01 aggregation
and I&A-02 registry resolution rather than duplicating them.

Legacy `dashboard-analytics` / `statistics` remain **LEGACY_BUT_ACTIVE**
inventory only — not migrated in I&A-03.

## Owned surface

- `runtime/**` — context, observations, source adapter contracts, normalization,
  registry resolution, projection pipeline, in-memory adapter, read-only facade
- Public exports via `src/features/intelligence-analytics/index.js`
- Architecture docs + this certification document
- Targeted tests: `tests/intelligence-analytics-ia-03-query-projection-runtime.test.js`
- Minimal CI registry entry in `scripts/ci/unit-test-files.json`

## Runtime flow

```text
AnalyticsQueryDescriptor
        │
        ▼
normalizeAnalyticsQuery / validateAnalyticsQueryExecution
        │
        ▼
resolveMetricFromRegistry (I&A-02)
        │
        ▼
AnalyticsSourceAdapter.query (read-only)
        │
        ▼
executeAnalyticsProjection
  tenant → time window → filter → group → aggregate → order → limit
        │
        ▼
AnalyticsResult (provenance + freshness preserved)
```

## Explicit non-goals

- Persisted / SQL / Supabase source adapters
- Competition / Finance / CRM / Player / Ranking / Rating adapters
- Dashboard metric migration (I&A-04+)
- Historical warehouse / alerts / AI
- Async Promise-based adapter orchestration (foundation is sync Result)
- Platform Core / Competition Engine / Business Module changes

## Validation expectations

1. Runtime creates from explicit registry + source adapter.
2. Missing metric / version returns typed errors.
3. Tenant missing / mismatch fails closed.
4. Query and observation inputs are not mutated.
5. Time-window, dimension filter, grouping, ordering are deterministic.
6. Count / sum / average / rate reuse I&A-01 aggregation.
7. Missing values are not silently coerced to zero.
8. Retired metrics reject; deprecated metrics warn with replacement metadata.
9. Provenance and freshness propagate; stale sources warn.
10. Source failures wrap to typed runtime errors.
11. Read-only facade rejects write operations.
12. Runtime does not import React / Supabase / Platform Core / business modules.
13. Invalid queries never call the source adapter.
14. No global singleton.

## Progress baseline

Before merge I&A-03: `2/13` structural workstreams certified (≈ 15.4%).

After post-merge verification I&A-03: `3/13` (≈ 23.1%).

Next default workstream: I&A-04 Dashboard and Reporting Data Contracts.
