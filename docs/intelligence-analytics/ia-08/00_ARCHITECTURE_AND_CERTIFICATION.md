# I&A-08 — Customer and Player Analytics

## Certification status

| Field | Value |
| --- | --- |
| Workstream | I&A-08 |
| Slice | Customer and Player Analytics |
| Module home | `src/features/intelligence-analytics/customer-player-analytics` |
| Baseline | fresh `origin/main` (extends merged I&A-01..I&A-07) |
| Platform Core | CLOSED — not modified |
| Customer Management | consumed only via future explicit adapters; no customer imports in this slice |
| Player Management | consumed only via future explicit adapters; no player imports in this slice |
| Player Rating / CRM / Club / Competition | not modified; rating/ranking/performance deferred to I&A-09 |
| SQL / migration / Supabase write | none |
| Dashboard UI / route changes | none |
| Identity merge / inferred customer-player links | none |
| CRM conversion / CLV / lead scoring | none |
| Module-specific production adapters | none (deferred) |

## Decision

I&A-01..07 provide metric identity, registry governance, query/projection
runtime, presentation-neutral dashboard/report contracts, historical/trend
analysis, competition analytics, and venue/court/club analytics. No canonical
Customer / Player Analytics source contract, privacy-safe analytical fact
envelope, customer/player metric catalog, inventory/lifecycle/linkage/
completeness/activity projections, or read-only Customer/Player Analytics
facade existed on `origin/main`.

Canonical operational boundaries remain:

- `src/features/customer` — customer master data, lifecycle, linkage SoT
- `src/features/player` — player profile, privacy projections
- `src/features/player-rating/foundation` — rating read/privacy (deferred analytics)
- `src/features/club` / Competition Engine — membership and participation SoT

Legacy `dashboard-analytics.getPlayerAnalytics` remains **MOCK_OR_PLACEHOLDER**
and is not migrated in I&A-08.

Therefore I&A-08 adds a Customer / Player Analytics foundation under
`src/features/intelligence-analytics/customer-player-analytics/**`, composing
I&A-01..07 contracts rather than duplicating them, and accepting only
**explicit privacy-safe analytical facts** from a read-only source adapter.

## Owned surface

- `customer-player-analytics/**` — context, privacy helpers, facts, snapshot,
  guards, source adapter, metric catalog, projections, historical observation
  composition, dashboard/report payload composers, read-only facade, in-memory
  certification source
- Public exports via `src/features/intelligence-analytics/index.js`
- Architecture docs + this certification document
- Targeted tests: `tests/intelligence-analytics-ia-08-customer-player-analytics.test.js`
- Minimal CI registry entry in `scripts/ci/unit-test-files.json`

## Flow

```text
Customer / Player canonical facades, snapshots or events
                         │
                         ▼
        CustomerPlayerAnalyticsSourceAdapter
                         │
                         ▼
       Privacy-Safe Explicit Analytical Facts
                         │
                         ▼
 Tenant / Customer / Player Guard → Validation
                         │
                         ▼
 Inventory / Lifecycle / Linkage / Activity Projections
                         │
                         ▼
 Historical Series + Dashboard/Report Payloads
                         │
                         ▼
            CustomerPlayerAnalyticsResult
```

## Privacy boundaries

Forbidden in analytical facts (non-exhaustive): full name, email, phone,
street address, full date of birth, government identifier, auth tokens,
payment/bank details, private notes, free-text profile, health/biometric data,
credentials.

Allowed: opaque customer/player/tenant IDs, explicit lifecycle/status
identifiers, explicit created/activity timestamps, explicit privacy-safe
profile-completeness descriptors, explicit canonical customer-player links,
aggregated activity counts, canonical source references.

Small-cohort suppression and advanced access certification are deferred to
I&A-11. I&A-08 enforces data minimization and fail-closed tenant isolation.

## Explicit non-goals

- Customer / Player command / mutation / workflow changes
- Identity resolution / merge / deduplication
- Inferred customer-player matching from profile similarity
- CRM conversion / lead scoring / marketing segmentation / CLV
- Rating / ranking / player performance / eligibility calculation
- Finance revenue / profitability calculation
- Production Customer/Player source adapters (deferred)
- Persisted analytics warehouse / ETL
- Dashboard UI migration / Experience Channel wiring
- Forecasting / AI metrics
- Platform Core / Competition Engine / Club / CRM / Rating source changes
- SQL / Supabase / localStorage access
- Package / lockfile changes

## Validation expectations

1. Valid analytics context; missing tenant rejected.
2. Tenant / customer / player isolation fail closed (no silent filter).
3. Link tenant mismatch and participation/membership player mismatch fail closed.
4. Input immutable; output frozen; no mutable state leakage.
5. Metric catalog stable ID/version; registry-compatible; duplicate conflict deterministic.
6. Customer / player counts and lifecycle distributions deterministic.
7. Profile-completeness from explicit facts only; missing ≠ false.
8. Linkage from explicit link facts only; missing links ≠ unlinked; zero denom → null.
9. Activity / participation / membership descriptive counts from explicit facts.
10. Historical observations compose via I&A-05; dashboard payloads via I&A-04.
11. Provenance / freshness / completeness preserved; stale yields warning.
12. PII fields rejected; errors do not echo PII values.
13. No React / Supabase / Platform Core / private business-module imports.
14. Read-only facade; no write surface; no global singleton.
15. Results set `isCanonicalCustomerPlayerState: false` / `isCanonicalModuleState: false`.
