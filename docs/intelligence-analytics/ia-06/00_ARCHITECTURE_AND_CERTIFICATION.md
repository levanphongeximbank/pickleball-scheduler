# I&A-06 — Competition Analytics

## Certification status

| Field | Value |
| --- | --- |
| Workstream | I&A-06 |
| Slice | Competition Analytics |
| Module home | `src/features/intelligence-analytics/competition-analytics` |
| Baseline | fresh `origin/main` (extends merged I&A-01..I&A-05) |
| Platform Core | CLOSED — not modified |
| Competition Engine | consumed only via future explicit adapters; no CE imports in this slice |
| Competition E2E | not depended upon for foundation wiring |
| SQL / migration / Supabase write | none |
| Dashboard UI / route changes | none |
| Scoring / standings / ranking recalculation | none |
| Module-specific production adapters | none (deferred) |

## Decision

I&A-01..05 provide metric identity, registry governance, query/projection
runtime, presentation-neutral dashboard/report contracts, and historical/trend
analysis. No canonical Competition Analytics source contract, analytical fact
envelope, competition metric catalog, progress/schedule/result projections, or
read-only Competition Analytics facade existed on `origin/main`.

Legacy `dashboard-analytics` mocks and `statistics` club aggregations remain
**LEGACY_BUT_ACTIVE** inventory and are not migrated in I&A-06.

Therefore I&A-06 adds a Competition Analytics foundation under
`src/features/intelligence-analytics/competition-analytics/**`, composing
I&A-01..05 contracts rather than duplicating them, and accepting only
**explicit analytical facts** from a read-only source adapter.

## Owned surface

- `competition-analytics/**` — context, facts, snapshot, guards, source adapter,
  metric catalog, projections, historical observation composition,
  dashboard/report payload composers, read-only facade, in-memory certification
  source
- Public exports via `src/features/intelligence-analytics/index.js`
- Architecture docs + this certification document
- Targeted tests: `tests/intelligence-analytics-ia-06-competition-analytics.test.js`
- Minimal CI registry entry in `scripts/ci/unit-test-files.json`

## Flow

```text
Competition Engine canonical facade/event/read model
                         │
                         ▼
      CompetitionAnalyticsSourceAdapter
                         │
                         ▼
      Explicit Competition Analytical Facts
                         │
                         ▼
 Validation → Tenant/Competition Guard → Projection
                         │
                         ▼
 Summary / Distribution / Progress / Historical Metrics
                         │
                         ▼
 CompetitionAnalyticsResult + Dashboard/Report Payloads
```

## Explicit non-goals

- Competition Engine command / mutation / workflow changes
- Scoring / winner / result-validation / standings / tie-break calculation
- Ranking / player-rating calculation
- Eligibility / seeding / scheduling / court / referee assignment decisions
- Production Competition Engine source adapter (deferred)
- Persisted competition analytics warehouse / ETL
- Dashboard UI migration / Experience Channel wiring
- Fairness / simulation / forecasting / AI metrics
- Platform Core / Business Module / package-lock changes
- SQL / Supabase / localStorage access

## Validation expectations

1. Valid Competition Analytics context; missing tenant/competition rejected.
2. Tenant / competition / version isolation fail closed (no silent filter).
3. Input immutable; output frozen; no mutable state leakage.
4. Metric catalog stable ID/version; registry-compatible; duplicate conflict deterministic.
5. Participant / entry / registration / division / category / team counts correct.
6. Match lifecycle / completion / progress deterministic; zero denominator → null (no Infinity).
7. Result acceptance counts/rates; pending/unknown behavior explicit.
8. Schedule adherence / duration from explicit timestamps; invalid/negative typed errors.
9. Missing timestamps not coerced to zero; incomplete snapshot not claimed complete.
10. Standings/ranking consumed opaquely; no scoring/winner/ranking calculation.
11. Historical observations compatible with I&A-05; dashboard payloads with I&A-04.
12. Read-only facade; no React / Platform Core / Supabase / Competition Engine imports.
13. No global singleton; I&A-01..05 regressions PASS.

## Progress baseline

Before merge I&A-06: `5/13` structural workstreams certified (≈ 38.5%).

After post-merge verification I&A-06: `6/13` (≈ 46.2%).

Next default workstream: I&A-07 Venue, Court and Club Analytics.
