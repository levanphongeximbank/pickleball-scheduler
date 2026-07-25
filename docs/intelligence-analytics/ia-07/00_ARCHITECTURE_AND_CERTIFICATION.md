# I&A-07 — Venue, Court and Club Analytics

## Certification status

| Field | Value |
| --- | --- |
| Workstream | I&A-07 |
| Slice | Venue, Court and Club Analytics |
| Module home | `src/features/intelligence-analytics/venue-court-club-analytics` |
| Baseline | fresh `origin/main` (extends merged I&A-01..I&A-06) |
| Platform Core | CLOSED — not modified |
| Venue / Court module | consumed only via future explicit adapters; no venue-court imports in this slice |
| Club Management | consumed only via future explicit adapters; no club imports in this slice |
| Competition Engine | not modified |
| SQL / migration / Supabase write | none |
| Dashboard UI / route changes | none |
| Availability / booking-conflict / authorization recalculation | none |
| Finance revenue / pricing / ledger | none |
| Module-specific production adapters | none (deferred) |

## Decision

I&A-01..06 provide metric identity, registry governance, query/projection
runtime, presentation-neutral dashboard/report contracts, historical/trend
analysis, and competition analytics. No canonical Venue / Court / Club Analytics
source contract, analytical fact envelope, venue/court/club metric catalog,
inventory/availability/utilization/membership projections, or read-only
Venue/Court/Club Analytics facade existed on `origin/main`.

Canonical operational boundaries remain:

- `src/features/venue-court` — inventory, operating hours, availability reads
- `src/features/club` — club identity, membership, roles, activity

Legacy `dashboard-analytics` utilization/fill-rate mocks and `domain/courtBookingEngine`
helpers remain **LEGACY_BUT_ACTIVE** inventory and are not migrated in I&A-07.

Therefore I&A-07 adds a Venue / Court / Club Analytics foundation under
`src/features/intelligence-analytics/venue-court-club-analytics/**`, composing
I&A-01..06 contracts rather than duplicating them, and accepting only
**explicit analytical facts** from a read-only source adapter.

## Owned surface

- `venue-court-club-analytics/**` — context, facts, snapshot, guards, source
  adapter, metric catalog, projections, historical observation composition,
  dashboard/report payload composers, read-only facade, in-memory certification
  source
- Public exports via `src/features/intelligence-analytics/index.js`
- Architecture docs + this certification document
- Targeted tests: `tests/intelligence-analytics-ia-07-venue-court-club-analytics.test.js`
- Minimal CI registry entry in `scripts/ci/unit-test-files.json`

## Flow

```text
Venue/Court/Club canonical facade, events or read models
                         │
                         ▼
      VenueCourtClubAnalyticsSourceAdapter
                         │
                         ▼
 Explicit Venue / Court / Club Analytical Facts
                         │
                         ▼
 Scope Guard → Validation → Deterministic Projection
                         │
                         ▼
 Inventory / Availability / Utilization / Membership Metrics
                         │
                         ▼
 Historical Series + Dashboard/Report Payloads
                         │
                         ▼
 VenueCourtClubAnalyticsResult
```

## Explicit non-goals

- Venue / Court / Club command / mutation / workflow changes
- Availability recalculation / booking-conflict resolution
- Operating-hours validation / overnight rule ownership
- Membership eligibility / role authorization / club governance decisions
- Finance revenue / pricing / ledger calculation
- Production Venue/Court/Club source adapters (deferred)
- Persisted operational analytics warehouse / ETL
- Dashboard UI migration / Experience Channel wiring
- Forecasting / AI metrics
- Platform Core / Competition Engine / Business Module / package-lock changes
- SQL / Supabase / localStorage access

## Validation expectations

1. Valid analytics context; missing tenant rejected.
2. Tenant / venue / court / club isolation fail closed (no silent filter).
3. Court-to-venue mismatch fail closed.
4. Input immutable; output frozen; no mutable state leakage.
5. Metric catalog stable ID/version; registry-compatible; duplicate conflict deterministic.
6. Venue / court / club counts and status distributions deterministic.
7. Availability from explicit facts only; missing ≠ zero; zero denominator → null.
8. Operating-hours totals from configured minutes; missing ≠ 24/7.
9. Booking volume / booked minutes per cancellation policy; no revenue.
10. Utilization method versioned; missing denominator → indeterminate/null.
11. Downtime / maintenance counts and rates from explicit facts.
12. Club membership / role / activity distributions; no permission calculation.
13. Historical observations compatible with I&A-05; dashboard payloads with I&A-04.
14. Read-only facade; no React / Platform Core / Supabase / venue-court / club imports.
15. No global singleton; I&A-01..06 regressions PASS.

## Progress baseline

Before merge I&A-07: `6/13` structural workstreams certified (≈ 46.2%).

After post-merge verification I&A-07: `7/13` (≈ 53.8%).

Next default workstream: I&A-08 Customer and Player Analytics.
