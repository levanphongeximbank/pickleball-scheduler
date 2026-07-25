# Reporting & Analytics — Architecture

## Phase

**REPORTING-05 — Final Certification & Business Module Closure**

Structural foundation through REPORTING-04 is complete. This document is the living architecture summary for the closed module posture (with accepted external residuals).

Foundation workstream id for historical contracts remains REPORTING-01; current module phase constant is REPORTING-05.

## Ownership

| Owner | Owns |
|-------|------|
| **Reporting & Analytics** (`src/features/reporting-analytics/`) | Operational report definitions, operational dashboards (domain/provenance), report filters, saved report configurations, report execution use cases, report execution authorization, export-facing use cases, module facades, presentation-ready operational report models, business-facing freshness/provenance, report availability/failure semantics, durable repositories, Staging SQL package |
| **Intelligence & Analytics** (`src/features/intelligence-analytics/`) | Metric registry, analytical projections, analytical query runtime, historical intelligence, trend/anomaly, predictive/AI readiness, reusable analytical datasets |
| **Statistics** (`src/features/statistics/`) | Business-truth statistics presentation + local metric helpers for season/session views — Reporting may consume, must not seize ownership |
| **dashboard-analytics** (legacy host) | Existing operational dashboard UI + live aggregation service; consumes Reporting provenance honesty |
| **Experience Channels** | Rendering dashboards/reports in channels |

## Dependency direction

```
Business Modules produce operational data
  → Intelligence & Analytics produces analytical projections
    → Reporting & Analytics composes operational reports
      → Experience Channels / app UI renders dashboards/reports
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

Workspace page secondary barrel: `src/features/reporting-analytics/ui/index.js`.

## Layering

```
index.js                 ← single public facade / barrel
constants/               ← types, scopes, availability, provenance, permissions
errors/                  ← module-local typed errors
contracts/               ← identity, scope, source refs, params/filters, execution, export
authorization/           ← fail-closed service-level authz
ports/                   ← repository + executor + clock/id ports
repositories/            ← deterministic in-memory test repositories only
persistence/             ← durable adapters + injected DB client port (REPORTING-02)
lifecycle/               ← execution/export status graphs
application/             ← facade + execute/export orchestration
export/                  ← presentation renderers + artifact storage ports
platform/                ← Platform Core adoption (public barrel only)
adapters/                ← dashboard provenance honesty + I&A UNAVAILABLE mapping
presentation/            ← source states, runtime inject, lifecycle VMs, workspace controller
ui/                      ← Reports workspace page/hooks (secondary public surface)
```

## Allowed imports

- `src/core/platform/index.js` (public Platform Core barrel only)
- `src/features/intelligence-analytics/index.js` (public I&A facade only)
- Reporting module internals

## Forbidden imports / patterns

- `src/features/intelligence-analytics/**` deep internals
- Finance / CRM / Customer / Competition / Venue / Club / Player internals as ownership
- Experience Channels internals
- `localStorage` as durable persistence
- browser `service_role`
- silent live→mock fallback success

## Persistence boundary

- Repository ports + durable adapters require an **injected** database client
- In-memory repositories are for tests/demo only
- No localStorage durable SoT
- SQL package: `docs/reporting-analytics/reporting-02/`
- Staging live apply/cert: Owner-accepted under REPORTING-03 (see reporting-05 evidence)
- Production apply: separate Owner gate

## Authorization boundary

Service-level fail-closed authorization (`authorizeReporting*`). Not menu visibility. Sensitive fields, save, and export are separately authorized. Authorization runs before source execution. Catalog seed does **not** auto-map `role_permissions`.

## Mock / provenance rules

- Explicit demo/preview → provenance `MOCK` / `PREVIEW`
- Live failure must not silently become mock success
- Unwired source / unwired runtime → `SOURCE_NOT_CONFIGURED` / `UNAVAILABLE`
- `MIXED` only when multiple component sources with differing provenance exist

## Accepted residuals (REPORTING-05)

1. Live I&A execute-by-projectionId not deployed → typed UNAVAILABLE
2. Browser runtime not composition-injected → typed UNAVAILABLE
3. Production rollout not performed

## Closure docs

See `docs/reporting-analytics/reporting-05/`.
