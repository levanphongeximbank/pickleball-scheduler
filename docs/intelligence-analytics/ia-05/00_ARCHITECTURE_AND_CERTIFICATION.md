# I&A-05 — Historical and Trend Analysis

## Certification status

| Field | Value |
| --- | --- |
| Workstream | I&A-05 |
| Slice | Historical and Trend Analysis |
| Module home | `src/features/intelligence-analytics/historical-trend` |
| Baseline | fresh `origin/main` (extends merged I&A-01..I&A-04) |
| Platform Core | CLOSED — not modified |
| Competition E2E | not depended upon |
| SQL / migration / Supabase write | none |
| Dashboard UI / route changes | none |
| Historical persistence / ETL / warehouse | none |
| Forecasting / ML / AI | none |
| Module-specific historical adapters | none (deferred) |

## Decision

I&A-01..04 provide metric identity, registry governance, query/projection
runtime, and presentation-neutral dashboard/report contracts. No canonical
historical query, deterministic bucketing, missing-period semantics, coverage
metadata, period comparison, or trend classification existed on `origin/main`.

Legacy `dashboard-analytics` trendPercent helpers and statistics histories remain
**LEGACY_BUT_ACTIVE** inventory and are not migrated in I&A-05.

Therefore I&A-05 adds a module-neutral historical/trend foundation under
`src/features/intelligence-analytics/historical-trend/**`, composing I&A-01
contracts, I&A-02 registry resolution, and I&A-03 read-only source adapters
rather than duplicating them.

## Owned surface

- `historical-trend/**` — query, observations/series, buckets, missing periods,
  coverage, comparison, change/growth, trend, moving-window, cumulative,
  read-only facade, in-memory certification source
- Public exports via `src/features/intelligence-analytics/index.js`
- Architecture docs + this certification document
- Targeted tests: `tests/intelligence-analytics-ia-05-historical-trend-analysis.test.js`
- Minimal CI registry entry in `scripts/ci/unit-test-files.json`

## Flow

```text
HistoricalQueryDescriptor
          │
          ▼
Metric registry resolution
          │
          ▼
Tenant/time validation
          │
          ▼
Read-only historical source
          │
          ▼
Historical observations
          │
          ▼
Normalize → Bucket → Fill/mark gaps
          │
          ▼
Compare → Change → Trend analysis
          │
          ▼
HistoricalTrendResult
```

## Trend method

Deterministic classifier `ia05.first_last_monotonic_cv_v1`:

1. Collect finite non-missing ordered values.
2. Fewer than 2 points → `INSUFFICIENT_DATA`.
3. First-to-last change + monotonic step ratio + coefficient of variation.
4. Classify `INCREASING` / `DECREASING` / `STABLE` / `VOLATILE` / `INDETERMINATE`.
5. Strength from relative magnitude and monotonic ratio.

No forecasting, causal inference, or recommendations.

## Missing-period policy

| Policy | Behavior |
| --- | --- |
| `preserve_missing` (default) | Keep null missing markers; never fill zero |
| `fill_null` | Synthetic null points with `synthetic_filled` origin |
| `fill_zero_when_allowed` | Fill `0` only when metric `missingDataSemantics=coalesce_zero` |
| `omit` | Drop missing buckets from series points (still listed in metadata) |

## Explicit non-goals

- Historical database / warehouse / snapshots
- ETL / event ingestion / scheduled jobs
- Module-specific Competition / Finance / Ranking / CRM adapters
- Dashboard trend migration / UI wiring
- Forecasting / anomaly detection / ML / AI
- Platform Core / Competition Engine / Business Module changes
- SQL / Supabase / localStorage access
- package/lockfile changes

## Validation expectations

1. Historical query create/reject/fail-closed tenant behavior.
2. Exact metric version resolve; retired reject; deprecated warn.
3. Deterministic daily/weekly/monthly bucketing; stable ordering.
4. Default does not fill zero; fill zero only when allowed.
5. Coverage/completeness never mark partial as complete.
6. Stale/provenance/freshness retained.
7. Period and baseline comparison; absolute/relative change; no Infinity.
8. Trend direction classifications deterministic.
9. Moving average/sum and cumulative sum/count.
10. Read-only facade; no React / Platform Core / Supabase / business imports.
11. No global singleton; I&A-01..04 regressions PASS.

## Progress baseline

Before merge I&A-05: `4/13` structural workstreams certified (≈ 30.8%).

After post-merge verification I&A-05: `5/13` (≈ 38.5%).

Next default workstream: I&A-06 Competition Analytics.
