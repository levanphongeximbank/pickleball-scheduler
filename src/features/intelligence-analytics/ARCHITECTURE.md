# Intelligence & Analytics — Architecture

## Purpose

Canonical, module-neutral analytics contracts and metric definition governance
for PICK_VN.

## Ownership

| Concern | Owner |
| --- | --- |
| Metric / query / result contracts | `src/features/intelligence-analytics/contracts` |
| Deterministic aggregation (explicit input) | `src/features/intelligence-analytics/aggregation` |
| Read-only analytics facade | `src/features/intelligence-analytics/facade` |
| Metric registry / lifecycle / compatibility | `src/features/intelligence-analytics/registry` |
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

**Out of scope:**

- Runtime source adapters / Supabase / SQL / migrations
- Persisted database registry
- Dashboard or route wiring
- Production metric catalog migration
- Competition / Finance / Ranking / Rating / CRM business rules
- AI inference / paid AI services
- Alert delivery / persistence
- Platform Core changes
- Query execution runtime (I&A-03)

## Dependency rules

- No import from `src/core/platform/**`
- No import from Competition Engine / Competition E2E
- No import from Finance / CRM / Customer / Player / Ranking business logic
- No React, Supabase client, or database table contracts
- Registry does not calculate metric values or own business rules
- Analytics output always sets `isCanonicalModuleState: false`

## Roadmap (structural)

1. I&A-01 Canonical Analytics Contracts Foundation ← certified
2. I&A-02 Metric Registry and Definition Governance ← current
3. I&A-03 Analytics Query and Projection Runtime
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
