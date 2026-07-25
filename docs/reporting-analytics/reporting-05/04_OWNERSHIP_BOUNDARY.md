# REPORTING-05 — Ownership Boundary

## Reporting owns

| Area | Location |
|------|----------|
| Report definitions | contracts + durable repo + SQL table |
| Saved reports / filters | contracts + durable repos + SQL |
| Report executions / export jobs | lifecycle + application + durable repos |
| Operational reporting provenance & presentation states | `contracts/provenance.js`, `presentation/*` |
| Report execution / export orchestration | `application/executeReport.js`, `exportReport.js` |
| Reporting public facade | `src/features/reporting-analytics/index.js` |
| Reporting workspace controller/UI | `presentation/reportsWorkspaceController.js`, `ui/*` |
| Reporting SQL security package | `docs/reporting-analytics/reporting-02/*.sql` |
| Platform adoption surface | `platform/reportingPlatformAdoption.js` |

## Reporting does not own

| Area | Owner |
|------|-------|
| Metric registry / analytical query runtime / projections internals | Intelligence & Analytics |
| Season/session statistical truth UI | Statistics |
| Legacy live KPI aggregation widgets | `dashboard-analytics` (presentation host) |
| Experience Channels rendering system | Experience Channels |
| Global application shell / routing framework | App shell |
| Role → permission matrix assignment | Identity (Owner decision) |
| Production release / env promotion | Platform governance / Owner ops |

## Dependency direction (certified)

```
Business data producers
  → I&A public facade (projections / analytics)
    → Reporting public facade (operational reports)
      → UI / Experience Channels (presentation)
```

Forbidden patterns verified absent in Reporting runtime sources:

- deep-import `intelligence-analytics/**` internals
- `localStorage.` / `sessionStorage.` durability
- browser `service_role`
- `createClient(` inside Reporting module
- silent LIVE → MOCK success rewrite

## Dual surfaces (accepted, not ownership seizure)

1. `dashboard-analytics` remains the operational dashboard UI host; consumes Reporting provenance via public index / bridge.
2. `ui/index.js` is a secondary barrel for `ReportsWorkspacePage` (page route import); domain SoT remains main `index.js`.
