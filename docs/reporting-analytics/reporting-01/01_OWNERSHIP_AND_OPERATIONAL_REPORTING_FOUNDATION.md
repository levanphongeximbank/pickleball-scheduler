# REPORTING-01 — Ownership & Operational Reporting Foundation

## Ownership decision

- **Reporting & Analytics** owns operational report definitions, operational dashboards (domain contracts), report filters, saved report/filter configurations, report execution use cases, report execution authorization, export-facing use cases, module-specific reporting facades, presentation-ready operational report models, business-facing freshness/provenance, and report availability/failure semantics.
- **Intelligence & Analytics** owns metric registry, cross-platform analytical projections, analytical query runtime, historical intelligence, trend/anomaly analysis, advanced insights, predictive/AI readiness, and reusable analytical datasets. I&A-04 presentation-neutral dashboard/report *data contracts* remain I&A-owned; Reporting consumes public I&A surface only.
- **Statistics** retains business-truth ownership for season/session statistics presentation and helpers. Reporting may compose Statistics-owned sources via typed source references; Statistics is not converted into Reporting.
- **dashboard-analytics** remains the legacy live UI + aggregation home. REPORTING-01 does not change dashboard UI behavior. An additive provenance bridge is provided for REPORTING-04.
- **Experience Channels** renders dashboards/reports; it does not own report workflow domain.

## Existing audit (read-only)

### dashboard-analytics

| Class | Paths |
|-------|-------|
| Public facade | `src/features/dashboard-analytics/index.js` |
| Domain/service | `services/dashboardService.js`, `dashboardScope.js`, `insightEngine.js` |
| Platform adapter | `platform/reportingPlatformAdapter.js` |
| Presentation/UI | `components/**`, hooks, constants |
| Mock | `src/data/mockDashboardData.js` (`buildMockDashboardPayload`, `isMock: true`) |
| Tests | `tests/dashboard-analytics.test.js`, `tests/reporting-platform-adoption.test.js` |

Live path builds KPIs from club data. Empty data **or** caught live errors currently fall back to mock payload (legacy behavior preserved; REPORTING-01 classifies this as MOCK and forbids silent live→mock success in the new execution foundation).

### statistics

UI-only public facade (`Statistics.jsx`). Metrics/export helpers are module-internal. Season standings truth remains outside Reporting ownership.

### intelligence-analytics

Public facade: `src/features/intelligence-analytics/index.js` (contracts, registry, runtime, dashboard-reporting). Reporting must not deep-import internals. When I&A projection is not wired, Reporting returns UNAVAILABLE via Reporting-side reference/port.

## Canonical module

- Module: `src/features/reporting-analytics/`
- Public entry: `src/features/reporting-analytics/index.js`
- Architecture: `src/features/reporting-analytics/ARCHITECTURE.md`
- Facade: `createReportingAnalyticsFacade` / `reportingAnalyticsFacade`

## Domain contracts

Identity: `reportDefinitionId`, `savedReportId`, `savedFilterId`, `executionId`, `exportJobId` / `exportRecordId`.

Definition: name/title/description, report type, scope, source reference, parameters, filters, sorting/grouping, columns, sensitivity, availability policy, freshness expectations, version.

Scope kinds: `TENANT`, `CLUB`, `VENUE`, `PLATFORM_CROSS_TENANT` (explicit permission required).

Source kinds: `OPERATIONAL`, `STATISTICS`, `INTELLIGENCE_PROJECTION`, `DASHBOARD_ADAPTER`, `UNAVAILABLE`.

Availability: `AVAILABLE`, `UNAVAILABLE`, `STALE`, `PARTIAL`, `MIXED`, `SOURCE_NOT_CONFIGURED`, `SOURCE_FAILED`, `AUTHORIZATION_DENIED`, `INVALID_*`.

Provenance: `LIVE`, `MOCK`, `PREVIEW`, `UNAVAILABLE`, `STALE`, `MIXED` (multi-source only).

## Authorization

Service-level permissions under `reporting.*` namespace. Fail-closed for missing actor, unknown permission, missing/ambiguous scope, tenant/venue/club mismatch. Cross-tenant requires `reporting.scope.cross_tenant`. Sensitive fields, save report/filter, and export are separately authorized and run before source execution.

## Persistence / export boundary

Ports for report definitions, saved reports, saved filters, export jobs. Deterministic in-memory repositories for tests only. Export request/result contracts exist; production file generation is **not** implemented. Unwired export executor → typed `SOURCE_NOT_CONFIGURED`.

No SQL. No Staging. No Production. No localStorage persistence.

## Mock / provenance

`MOCK_DASHBOARD_DATA_CLASSIFICATION` marks `mockDashboardData` as development/preview fallback. `assertNoSilentLiveToMockFallback` rejects live failure rewritten as mock/preview/live success.

## Platform Core adoption

`src/features/reporting-analytics/platform/` consumes `src/core/platform/index.js` only (`ok`/`fail`, identity/tenant projection, ISO clock). Legacy `dashboard-analytics/platform` adapter remains additive and unchanged in behavior.

## Explicit exclusions / limitations

REPORTING-01 does **not** complete the Business Module. Missing:

- durable persistence
- production report execution integration
- export runtime
- Staging apply
- dashboard UI adoption
- final certification

## REPORTING-02 handoff conditions

- REPORTING-01 PR merged + post-merge verification PASS
- canonical contracts / repository ports / authorization actions stable
- no unresolved ownership collision with I&A or Statistics
- durable schema design can start without changing domain ownership
