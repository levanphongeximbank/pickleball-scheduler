# I&A-04 — Dashboard and Reporting Data Contracts

## Certification status

| Field | Value |
| --- | --- |
| Workstream | I&A-04 |
| Slice | Dashboard and Reporting Data Contracts |
| Module home | `src/features/intelligence-analytics/dashboard-reporting` |
| Baseline | fresh `origin/main` (extends merged I&A-01 + I&A-02 + I&A-03) |
| Platform Core | CLOSED — not modified |
| Competition E2E | not depended upon |
| SQL / migration / Supabase write | none |
| Dashboard UI / route changes | none |
| Export / schedule runtime | metadata only |
| Module-specific catalogs | none (deferred) |

## Decision

I&A-01..03 provide metric identity, registry governance, and a query/projection
runtime. No canonical presentation-neutral dashboard or reporting data contract
existed on `origin/main`. Legacy `dashboard-analytics` and `statistics` remain
**LEGACY_BUT_ACTIVE** inventory and are not migrated in I&A-04.

Therefore I&A-04 adds immutable dashboard/report definitions, bindings,
payloads, data-state semantics, catalog discovery, and compatibility checks
under `src/features/intelligence-analytics/dashboard-reporting/**`, composing
I&A-01 query descriptors and optional I&A-02 registry validation rather than
duplicating them.

## Owned surface

- `dashboard-reporting/**` — definitions, bindings, presentation intent,
  payloads, data states, drill-down, filter/parameter, export/schedule intent,
  catalog, compatibility
- Public exports via `src/features/intelligence-analytics/index.js`
- Architecture docs + this certification document
- Targeted tests: `tests/intelligence-analytics-ia-04-dashboard-reporting-contracts.test.js`
- Minimal CI registry entry in `scripts/ci/unit-test-files.json`

## Contract flow

```text
DashboardDefinition / ReportDefinition
                │
                ▼
Metric and query bindings
                │
                ▼
I&A-03 Query Runtime (future consumer boundary)
                │
                ▼
AnalyticsResult
                │
                ▼
Presentation-neutral dashboard/report payload
                │
                ▼
Existing or future Experience Channel renderer
```

## Explicit non-goals

- React / MUI / chart renderers
- Dashboard page or report page redesign
- Global route changes
- Export generator / PDF / CSV / XLSX engines
- Scheduler / email / notification delivery
- Persisted catalog or SQL adapters
- Competition / Finance / CRM / Player / Ranking adapters
- AI-generated narrative
- Platform Core / Competition Engine / Business Module changes

## Validation expectations

1. Valid dashboard and report definitions create successfully.
2. Missing ID/version rejects.
3. Duplicate section / widget / column IDs reject.
4. Metric binding requires exact version; optional registry validates lifecycle.
5. Query binding reuses I&A-01 descriptors and does not mutate input.
6. Definitions and catalog inputs/outputs are immutable.
7. Exact ID/version lookup and conflict/idempotent registration behave deterministically.
8. Tenant applicability and access-scope filters are deterministic.
9. Definitions reject React/JSX, Supabase/table, route callback, and executable formatter content.
10. EMPTY ≠ READY; PARTIAL ≠ READY; STALE keeps freshness; ERROR keeps typed error; UNAVAILABLE ≠ EMPTY.
11. KPI / series / breakdown / table payloads preserve identity, provenance, and deterministic ordering.
12. Missing data is not silently coerced to zero.
13. Drill-down preserves tenant scope and rejects executable callbacks.
14. Export/schedule intents are metadata only (`runtimeInitialized: false`).
15. Compatibility classifies IDENTICAL / BACKWARD_COMPATIBLE / BREAKING deterministically.
16. Read-only catalog rejects write/persistence commands.
17. Module does not import React, Platform Core, Competition/Finance/CRM/Player, or Supabase.
18. No global singleton catalog.

## Progress baseline

Before merge I&A-04: `3/13` structural workstreams certified (≈ 23.1%).

After post-merge verification I&A-04: `4/13` (≈ 30.8%).

Next default workstream: I&A-05 Historical and Trend Analysis.
