# Reporting & Analytics — Architecture (REPORTING-01)

## Phase

**REPORTING-01 — Ownership & Operational Reporting Foundation**

Structural domain foundation only. No SQL, no Staging/Production, no dashboard UI adoption, no durable persistence, no production export runtime.

## Ownership

| Owner | Owns |
|-------|------|
| **Reporting & Analytics** (`src/features/reporting-analytics/`) | Operational report definitions, operational dashboards (domain), report filters, saved report configurations, report execution use cases, report execution authorization, export-facing use cases, module facades, presentation-ready operational report models, business-facing freshness/provenance, report availability/failure semantics |
| **Intelligence & Analytics** (`src/features/intelligence-analytics/`) | Metric registry, analytical projections, analytical query runtime, historical intelligence, trend/anomaly, predictive/AI readiness, reusable analytical datasets, presentation-neutral dashboard/report *data contracts* (I&A-04) |
| **Statistics** (`src/features/statistics/`) | Business-truth statistics presentation + local metric helpers for season/session views — Reporting may consume, must not seize ownership |
| **dashboard-analytics** (legacy) | Existing operational dashboard UI + live aggregation service + Platform projections; presentation behavior preserved in REPORTING-01 |
| **Experience Channels** | Rendering dashboards/reports in channels |

## Dependency direction

```
Business Modules produce operational data
  → Intelligence & Analytics produces analytical projections
    → Reporting & Analytics composes operational reports
      → Experience Channels renders dashboards/reports
```

## Public import

```js
import {
  createReportingAnalyticsFacade,
  reportingAnalyticsFacade,
  REPORT_TYPE,
  REPORT_PROVENANCE,
  REPORTING_PERMISSIONS,
} from "../features/reporting-analytics/index.js";
```

Canonical facade factory: **`reportingAnalyticsFacade`** (alias of `createReportingAnalyticsFacade`).

## Layering

```
index.js                 ← single public facade / barrel
constants/               ← types, scopes, availability, provenance, permissions
errors/                  ← module-local typed errors
contracts/               ← identity, scope, source refs, params/filters, execution, export
authorization/           ← fail-closed service-level authz
ports/                   ← repository + executor + clock/id ports (no durable adapter)
repositories/            ← deterministic in-memory test repositories only
application/             ← facade + execute/export orchestration
platform/                ← Platform Core adoption (public barrel only)
adapters/                ← dashboard mock provenance honesty + I&A UNAVAILABLE refs
```

## Allowed imports

- `src/core/platform/index.js` (public Platform Core barrel only)
- `src/features/intelligence-analytics/index.js` (public I&A facade only — optional consume)
- Reporting module internals

## Forbidden imports

- `src/features/intelligence-analytics/**` deep internals (`contracts/`, `runtime/`, `registry/`, `dashboard-reporting/` paths)
- Finance / CRM / Customer / Competition / Venue / Club / Player internals as ownership
- Experience Channels internals
- `localStorage` as persistence
- SQL / Supabase clients as durable SoT in this phase

## Persistence boundary

Repository **ports** + in-memory test implementations only. REPORTING-01 does not ship SQL, Supabase adapters, localStorage, or claim durable persistence.

## Authorization boundary

Service-level fail-closed authorization (`authorizeReporting*`). Not menu visibility. Sensitive fields, save, and export are separately authorized. Authorization runs before source execution.

## Mock / provenance rules

- `mockDashboardData` = development/preview fallback → provenance `MOCK`
- Live failure must not silently become mock success
- Unwired source → `SOURCE_NOT_CONFIGURED` / `UNAVAILABLE`
- `MIXED` only when multiple component sources with differing provenance exist

## Explicit non-goals (REPORTING-01)

- Durable persistence / SQL / RLS / Staging / Production
- Production report execution integration
- Export file generation runtime
- Dashboard UI adoption / Statistics ownership transfer
- Metric registry / analytical query runtime ownership
- Declaring the full Business Module complete

## Follow-ups

- REPORTING-02 — Durable Report Persistence, Execution & Export
- REPORTING-03 — Staging Apply & Projection Integration
- REPORTING-04 — Dashboard/UI Adoption & Mock Honesty
- REPORTING-05 — Final Certification & Closure
