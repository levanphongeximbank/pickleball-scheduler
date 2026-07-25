# Intelligence & Analytics — Architecture

## Purpose

Canonical, module-neutral analytics contracts, metric definition governance,
a read-only query/projection runtime, presentation-neutral
dashboard/reporting data contracts, and historical/trend analysis for PICK_VN.

## Ownership

| Concern | Owner |
| --- | --- |
| Metric / query / result contracts | `src/features/intelligence-analytics/contracts` |
| Deterministic aggregation (explicit input) | `src/features/intelligence-analytics/aggregation` |
| Read-only analytics facade (I&A-01) | `src/features/intelligence-analytics/facade` |
| Metric registry / lifecycle / compatibility | `src/features/intelligence-analytics/registry` |
| Query / projection runtime (I&A-03) | `src/features/intelligence-analytics/runtime` |
| Dashboard / reporting data contracts (I&A-04) | `src/features/intelligence-analytics/dashboard-reporting` |
| Historical / trend analysis (I&A-05) | `src/features/intelligence-analytics/historical-trend` |
| Competition analytics (I&A-06) | `src/features/intelligence-analytics/competition-analytics` |
| Venue / Court / Club analytics (I&A-07) | `src/features/intelligence-analytics/venue-court-club-analytics` |
| Customer / Player analytics (I&A-08) | `src/features/intelligence-analytics/customer-player-analytics` |
| Finance / Ranking / Performance analytics (I&A-09) | `src/features/intelligence-analytics/finance-ranking-performance-analytics` |
| Operational Alerts and Insights (I&A-10) | `src/features/intelligence-analytics/operational-alerts-insights` |
| Privacy / Tenant Isolation / Access Certification (I&A-11) | `src/features/intelligence-analytics/privacy-access-certification` |
| AI / Advanced Intelligence Readiness (I&A-12) | `src/features/intelligence-analytics/ai-advanced-intelligence-readiness` |
| Integration Hardening / Final Certification (I&A-13) | `src/features/intelligence-analytics/integration-hardening-final-certification` |
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

**In scope (I&A-04):**

- Dashboard / report identity and version contracts
- Dashboard section / widget and report section / column definitions
- Metric and query bindings (exact ID/version; reuse I&A-01 descriptors)
- Presentation-neutral visualization intent
- KPI / time-series / breakdown / comparison / table payloads
- Explicit EMPTY / PARTIAL / STALE / UNAVAILABLE / ERROR data states
- Drill-down descriptor (no routes / callbacks)
- Filter / parameter / export / schedule intent metadata
- Immutable catalog + read-only discovery facade
- Compatibility classification between definition versions

**In scope (I&A-05):**

- Historical query descriptor (exact metric ID/version, tenant, window, granularity)
- Historical observation / series / coverage / completeness contracts
- Deterministic UTC bucketing (hour / day / week / month)
- Explicit missing-period policies (default fail-safe: preserve missing)
- Period-over-period and explicit baseline comparison
- Absolute / relative change and growth rate (no Infinity on zero baseline)
- Deterministic trend direction / strength classification
- Moving-window (average / sum / count) and cumulative (sum / count)
- Provenance / freshness / stale propagation
- Read-only historical facade + in-memory certification source

**In scope (I&A-06):**

- Competition analytics context / source request / snapshot envelope
- Explicit competition analytical fact contracts (participant, entry, registration,
  division, category, team, roster, match, schedule, assignment, result,
  standings/ranking snapshot references)
- Tenant / competition / version isolation guards (fail closed)
- Versioned competition metric catalog (registry-compatible)
- Deterministic summary, distribution, progress, result-acceptance,
  schedule-adherence, duration, and assignment projections
- Historical observation composition via I&A-05 contracts
- Presentation-neutral dashboard/report payload composition via I&A-04
- Read-only Competition Analytics facade + in-memory certification source
- Typed competition analytics errors / warnings / provenance / completeness

**In scope (I&A-07):**

- Venue / Court / Club analytics context / source request / snapshot envelope
- Explicit venue, court, operating-hours, availability, booking, maintenance,
  downtime, club, membership, role, and activity analytical fact contracts
- Tenant / venue / court / club isolation guards (fail closed)
- Versioned venue/court/club metric catalog (registry-compatible)
- Deterministic venue/court inventory, availability, utilization, booking-volume,
  operating-hours, downtime, and club membership/role/activity projections
- Historical observation composition via I&A-05 contracts
- Presentation-neutral dashboard/report payload composition via I&A-04
- Read-only Venue/Court/Club Analytics facade + in-memory certification source
- Typed venue/court/club analytics errors / warnings / provenance / completeness

**In scope (I&A-08):**

- Customer / Player analytics context / source request / snapshot envelope
- Privacy-safe customer, player, lifecycle, profile-completeness, activity,
  customer-player link, competition-participation, and club-membership fact
  contracts (opaque IDs only; no PII fields)
- Tenant / customer / player isolation guards (fail closed)
- Versioned customer/player metric catalog (registry-compatible)
- Deterministic inventory, lifecycle/status, profile-completeness, linkage,
  activity-volume, participation, and membership descriptive projections
- Historical observation composition via I&A-05 contracts
- Presentation-neutral dashboard/report payload composition via I&A-04
- Read-only Customer/Player Analytics facade + in-memory certification source
- Typed customer/player analytics errors / warnings / provenance / completeness

**In scope (I&A-09):**

- Finance / Ranking / Performance analytics context / source request / snapshot envelope
- Analytical money contract (integer minor units only; no floating point; no
  currency conversion; fail-closed mixed-currency arithmetic)
- Explicit finance fact contracts (transaction, invoice, payment, refund,
  settlement, receivable, recognized revenue/expense amount) — overdue and
  recognition are always explicit signals, never inferred from dates or from
  booking/payment facts
- Explicit ranking fact contracts (ranking system, ranking snapshot with
  explicit rank-direction metadata, ranking position) — never a source of
  computed standings
- Explicit rating fact contracts (rating snapshot, rating change with
  explicit or before/after-derived delta) — never a rating-algorithm
  recalculation
- Explicit performance fact contracts (participation, match, outcome with
  explicit outcome/validationStatus) — winner is never inferred from score
- Tenant / currency / ranking-system / rating-system / player / team /
  competition isolation guards (fail closed)
- Versioned finance/ranking/performance metric catalog (registry-compatible;
  currency-safe aggregation documented on every monetary metric)
- Deterministic finance, ranking (including compatible-system-only movement
  comparison), rating, and performance summary projections
- Historical observation composition via I&A-05 contracts (currency /
  ranking-system / rating-system / entity dimensions preserved)
- Presentation-neutral dashboard/report payload composition via I&A-04
- Read-only Finance/Ranking/Performance Analytics facade + in-memory
  certification source
- Typed finance/ranking/performance analytics errors / warnings / provenance
  / completeness
- PII and payment-credential rejection at the fact-creation boundary

**In scope (I&A-10):**

- Operational signal contracts (identity, value/state/trend, provenance,
  freshness, completeness) referencing merged I&A metric identities
- Alert rule / insight rule contracts with explicit severity and evaluation type
- Threshold / state / trend / missing-data / freshness condition contracts
- Immutable foundation rule catalog (in-memory only)
- Tenant / entity / currency / ranking / metric-version isolation guards
- Deterministic evaluation, deduplication, correlation, suppression/cooldown,
  and lifecycle projection (OPEN / ACKNOWLEDGED / RESOLVED / EXPIRED / SUPPRESSED)
- Explainable alert and insight payloads (`isCanonicalDomainState: false`,
  `isDeliveredNotification: false`)
- Future-safe `AlertNotificationCandidate` without recipient/channel/delivery
- Presentation-neutral alert/insight dashboard/report payload composition via I&A-04
- Read-only Operational Alerts and Insights facade + in-memory certification source
- Typed operational alerts errors / warnings / provenance / completeness

**In scope (I&A-11):**

- Trusted analytics privacy access-context contracts (explicit tenant,
  trusted-source marker, policy version, metric/dimension grants)
- Data-classification contracts (PUBLIC → PRIVILEGED_OPERATIONAL) with
  most-restrictive deterministic resolution and unknown fail-closed
- Privacy-policy and access-decision contracts (ALLOW / DENY / REDACT /
  OMIT / SUPPRESS) with privacy-safe evidence
- Tenant and entity isolation certification (fail closed; typed contamination)
- Metric / dimension access evaluation and discovery filtering
- Deterministic small-cohort suppression (policy-threshold; never zero)
- Redaction / omission evaluators and privacy-safe error sanitization
- Historical / dashboard / alert-insight privacy projectors
- Certification scenario / evidence / report contracts
- Read-only certification facade + in-memory policy source

**In scope (I&A-12):**

- Provider-neutral intelligence use-case definitions and registry governance
- Risk tiers (LOW / MODERATE / HIGH / PROHIBITED) with fail-closed unknown
- Structured feature-schema and privacy-safe feature-vector contracts
- Model / provider / prompt-template reference contracts (no secrets)
- Inference request / untrusted response validation contracts
- Candidate insight, confidence, uncertainty, explanation, evidence contracts
- Human-review, safety, abstention, fallback and prohibited-use-case guards
- Privacy / tenant / entity enforcement through I&A-11
- Deterministic offline in-memory certification provider (no network)
- Evaluation scenario / result / report and quality-gate contracts
- Drift / quality / model-health signal contracts (no auto-retrain/switch)
- Presentation-neutral candidate-insight payloads via I&A-04 shapes
- Read-only AI readiness facade; non-canonical advisory outputs only

**In scope (I&A-13):**

- Final certification manifest and certified-surface registry (I&A-01..13)
- Certification dimension / scenario / evidence / result / final report contracts
- Public-export, contract, metric-registry, and error-registry verifiers
- Tenant / entity / privacy / currency / ranking-rating verifiers
- Operational-alert and AI-readiness boundary verifiers
- Read-only / no-write / no-private-import / no-database / no-provider verifiers
- Mock-honesty and source-state semantics certification
- Deterministic certification runner and closure-readiness evaluator
- In-memory certification-only source + read-only final certification facade
- Architecture closure documentation and targeted certification tests

**Out of scope:**

- Database / Supabase / SQL / migrations
- Module-specific production source adapters
- Persisted database registry / dashboard catalog / historical warehouse
- Dashboard UI, report renderer, route wiring
- Export generator / scheduler / email delivery runtime
- Production metric catalog migration
- Competition / Finance / Ranking / Rating / CRM / Customer / Player business rules
- Scoring / winner / standings / tie-break / ranking recalculation
- Eligibility / seeding / scheduling / assignment decision engines
- Availability / booking-conflict / operating-hours / membership authorization
  recalculation
- Customer identity merge / deduplication / inferred customer-player matching
- CRM conversion / lead scoring / marketing segmentation / CLV
- Player skill / rating / ranking / performance calculation
- PII inspection for profile-completeness (explicit source facts only)
- Finance revenue / pricing / ledger calculation
- Ledger posting / revenue recognition decisions / currency conversion
- Ranking / rating / standings / score / winner calculation or recalculation
- Treating booking or payment facts as revenue
- Inferring receivable overdue status from due dates
- Inferring match winner from raw score
- AI inference / paid AI services / Production model hosting / embeddings /
  RAG / vector DB / agent tool execution / model training
- Alert delivery / persistence / notification recipient resolution
- Background evaluation scheduler / remediation / escalation execution
- Platform Core changes

## AI / advanced intelligence readiness flow (I&A-12)

```text
Certified I&A-01..11 Analytical Results
                    │
                    ▼
       IntelligenceUseCaseDefinition
                    │
                    ▼
 Privacy / Access / Tenant / Entity Guard (I&A-11)
                    │
                    ▼
 Structured Feature Schema and Feature Vector
                    │
                    ▼
       Provider-Neutral Inference Request
                    │
                    ▼
 Offline Certification Provider / Future Adapter
                    │
                    ▼
 Untrusted Provider Response Validation
                    │
                    ▼
 Candidate Insight + Confidence + Explanation
                    │
                    ▼
 Risk Policy → Abstain / Reject / Human Review
                    │
                    ▼
 Privacy-Safe Presentation Payload
                    │
                    ▼
 Evaluation / Quality / Drift Evidence
```

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

## Contract flow (I&A-04)

```text
DashboardDefinition / ReportDefinition
                │
                ▼
Metric and query bindings
                │
                ▼
I&A-03 Query Runtime (consumer; not wired here)
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

## Historical / trend flow (I&A-05)

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

## Competition analytics flow (I&A-06)

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

## Venue / Court / Club analytics flow (I&A-07)

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

## Customer / Player analytics flow (I&A-08)

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

## Finance / Ranking / Performance analytics flow (I&A-09)

```text
Finance / Ranking / Rating / Competition canonical facades, snapshots or events
                         │
                         ▼
   FinanceRankingPerformanceAnalyticsSourceAdapter
                         │
                         ▼
  Privacy-Safe, Currency-Safe Explicit Analytical Facts
                         │
                         ▼
 Tenant / Currency / RankingSystem / RatingSystem / Player / Team / Competition
                         Guard → Validation
                         │
                         ▼
 Finance / Ranking (+ Movement) / Rating / Performance Projections
                         │
                         ▼
 Historical Series + Dashboard/Report Payloads
                         │
                         ▼
      FinanceRankingPerformanceAnalyticsResult
```

## Operational alerts / insights flow (I&A-10)

```text
I&A-01..09 metrics, observations, trends and explicit facts
                         │
                         ▼
        OperationalSignalSourceAdapter
                         │
                         ▼
   Signal Normalization + Scope/Freshness Validation
                         │
                         ▼
 Alert Rule / Insight Rule Deterministic Evaluation
                         │
                         ▼
 Deduplication / Suppression / Lifecycle Projection
                         │
                         ▼
 AlertResult / InsightResult / Dashboard Payloads
                         │
                         ▼
 Read-only consumer boundary for future Notification adapter
```

## Dependency rules

- No import from `src/core/platform/**`
- No import from Competition Engine / Competition E2E
- No import from Finance / CRM / Customer / Player / Ranking business logic
- No React, Supabase client, or database table contracts
- Registry does not calculate metric values or own business rules
- Runtime does not own module business calculations
- Dashboard/report contracts do not own UI, export engines, or schedulers
- Historical/trend does not own persistence, ETL, forecasting, or module adapters
- Competition analytics does not recalculate scoring / standings / ranking /
  eligibility / scheduling / assignment decisions
- Venue/Court/Club analytics does not recalculate availability, booking conflict,
  operating-hours validity, membership eligibility, roles/permissions, or revenue
- Customer/Player analytics does not merge identities, infer customer-player
  links, inspect PII for completeness, calculate CRM conversion / CLV /
  rating / ranking / performance / eligibility, or accept PII fact fields
- Finance/Ranking/Performance analytics does not post ledger entries,
  recognize revenue, convert currency, recalculate ranking/rating/standings/
  score/winner, treat booking/payment facts as revenue, infer overdue from
  dates, infer winner from score, or accept PII/payment-credential fact fields
- Analytics output always sets `isCanonicalModuleState: false`
- Privacy/access certification consumes trusted access context only; does not
  replace Platform Core authorization or mutate business-module access rules
- AI readiness outputs are advisory candidates only (`isCanonicalDomainState:
  false`); no Production provider, secrets, network calls, tool/SQL/shell/eval
  execution, domain mutations, or automatic business decisions
- Final certification is structural-foundation only; Production adapters remain
  deferred and must not be claimed active or LIVE

## Final integration certification flow (I&A-13)

```text
I&A-01..12 Public Surfaces
             │
             ▼
Final Analytics Surface Registry
             │
             ▼
Contract / Metric / Error / Export Validation
             │
             ▼
Tenant / Entity / Privacy / Currency / Version Invariants
             │
             ▼
Read-Only / No-Write / No-Private-Import Certification
             │
             ▼
Cross-Surface Integration Scenarios
             │
             ▼
Deterministic Final Certification Report
             │
             ▼
ReadOnlyIntelligenceAnalyticsFinalCertificationFacade
```

## Roadmap (structural)

1. I&A-01 Canonical Analytics Contracts Foundation ← certified
2. I&A-02 Metric Registry and Definition Governance ← certified
3. I&A-03 Analytics Query and Projection Runtime ← certified
4. I&A-04 Dashboard and Reporting Data Contracts ← certified
5. I&A-05 Historical and Trend Analysis ← certified
6. I&A-06 Competition Analytics ← certified
7. I&A-07 Venue, Court and Club Analytics ← certified
8. I&A-08 Customer and Player Analytics ← certified
9. I&A-09 Finance, Ranking and Performance Analytics ← certified
10. I&A-10 Operational Alerts and Insights ← certified
11. I&A-11 Privacy, Tenant Isolation and Access Certification ← certified
12. I&A-12 AI and Advanced Intelligence Readiness ← certified
13. I&A-13 Integration Hardening and Final Certification ← current
