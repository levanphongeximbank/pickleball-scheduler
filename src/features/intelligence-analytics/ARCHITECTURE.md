# Intelligence & Analytics — Architecture

## Purpose

Canonical, module-neutral analytics contracts, metric definition governance,
and a read-only query/projection runtime for PICK_VN.

## Ownership

| Concern | Owner |
| --- | --- |
| Metric / query / result contracts | `src/features/intelligence-analytics/contracts` |
| Deterministic aggregation (explicit input) | `src/features/intelligence-analytics/aggregation` |
| Read-only analytics facade (I&A-01) | `src/features/intelligence-analytics/facade` |
| Metric registry / lifecycle / compatibility | `src/features/intelligence-analytics/registry` |
| Query / projection runtime (I&A-03) | `src/features/intelligence-analytics/runtime` |
| Dashboard UI / localStorage analytics | `src/features/dashboard-analytics` (legacy active; not foundation) |
| Statistics UI aggregations | `src/features/statistics` (legacy active; not foundation) |
| Platform Core | CLOSED — not modified, not imported |
| Competition Engine / E2E | External — not imported |

## Boundaries

**In scope (I&A-01):**

- Metric ID / version / definition
- Source + provenance
- Tenant scope (fail closed)
- Time window + granularity
- Query descriptor (immutable)
- Data point / series / result / warning / error
- Read-only analytics facade
- Deterministic count / sum / average / rate over explicit observations

**In scope (I&A-02):**

- Canonical metric registry (explicit in-memory definitions)
- Registration contract, idempotency, and ID/version conflict detection
- Lifecycle states: draft / active / deprecated / retired
- Deprecation + replacement metadata
- Definition validation composed on I&A-01 contracts
- Compatibility classification between definition versions
- Deterministic lookup / list / discovery
- Read-only registry facade

**In scope (I&A-03):**

- Runtime / access context contracts
- Read-only source adapter + observation contracts
- Query normalization and execution validation
- Registry-backed metric resolution
- Deterministic projection pipeline (tenant / time / filter / group / aggregate / order / limit)
- Provenance and freshness propagation
- In-memory source adapter (certification only)
- Read-only query runtime facade
- Typed runtime errors / warnings / observability hooks (contract-level)

**Out of scope:**

- Database / Supabase / SQL / migrations
- Module-specific production source adapters
- Persisted database registry
- Dashboard or route wiring
- Production metric catalog migration
- Competition / Finance / Ranking / Rating / CRM business rules
- AI inference / paid AI services
- Alert delivery / persistence / historical warehouse
- Platform Core changes

## Runtime flow (I&A-03)

```text
AnalyticsQueryDescriptor
        │
        ▼
Query validation and normalization
        │
        ▼
Metric registry resolution
        │
        ▼
Tenant and access context validation
        │
        ▼
Read-only analytics source adapter
        │
        ▼
Module-neutral observations
        │
        ▼
Projection / filter / group / aggregate / order / limit
        │
        ▼
AnalyticsResult
```

## Dependency rules

- No import from `src/core/platform/**`
- No import from Competition Engine / Competition E2E
- No import from Finance / CRM / Customer / Player / Ranking business logic
- No React, Supabase client, or database table contracts
- Registry does not calculate metric values or own business rules
- Runtime does not own module business calculations
- Analytics output always sets `isCanonicalModuleState: false`

## Roadmap (structural)

1. I&A-01 Canonical Analytics Contracts Foundation ← certified
2. I&A-02 Metric Registry and Definition Governance ← certified
3. I&A-03 Analytics Query and Projection Runtime ← current
4. I&A-04 Dashboard and Reporting Data Contracts
5. I&A-05 Historical and Trend Analysis
6. I&A-06 Competition Analytics
7. I&A-07 Venue, Court and Club Analytics
8. I&A-08 Customer and Player Analytics
9. I&A-09 Finance, Ranking and Performance Analytics
10. I&A-10 Operational Alerts and Insights
11. I&A-11 Privacy, Tenant Isolation and Access Certification
12. I&A-12 AI and Advanced Intelligence Readiness
13. I&A-13 Integration Hardening and Final Certification
