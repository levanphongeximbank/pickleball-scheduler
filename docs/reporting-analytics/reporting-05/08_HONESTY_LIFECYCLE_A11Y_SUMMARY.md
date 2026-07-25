# REPORTING-05 — Mock Honesty, Provenance, Lifecycle & A11y Summary

Canonical implementations (do not duplicate large evidence):

| Topic | Canonical |
|-------|-----------|
| Provenance contracts | `src/features/reporting-analytics/contracts/provenance.js` |
| Dashboard classification | `adapters/dashboardProvenance.js` + `dashboard-analytics` service |
| Presentation states | `presentation/sourceState.js` |
| Lifecycle VMs | `presentation/lifecycleViewModel.js` |
| Workspace controller | `presentation/reportsWorkspaceController.js` |
| Tests | `tests/reporting-analytics-reporting-04-dashboard-ui-adoption.test.js` (+ R01 provenance/export) |

## Mock honesty (certified)

- Live error does **not** fallback to mock
- Live empty does **not** fabricate KPIs / win-rate / Elo / new-customer %
- Mock only in explicit demo/preview
- Unavailable ≠ empty
- Stale carries freshness/reason when classified
- Source status has readable text (not color-only)
- Retry is a real reload action
- Previous success does not mask current error
- No silent catch returning fixture
- No false LIVE provenance

## Execution / export lifecycle (certified)

Statuses: PENDING → RUNNING → SUCCEEDED | FAILED | UNAVAILABLE  
Invalid transitions rejected.  
Export SUCCEEDED requires valid output reference; `fake://` / `mock://` rejected.  
Renderer/storage unavailable → UNAVAILABLE.  
Sensitive export uses `reporting.field.sensitive.view` + service authorizeExport.

## Accessibility / authorization presentation (certified)

- Loading: aria-busy / accessible labeling on workspace surfaces
- Error: real retry with accessible name
- Lifecycle status readable to AT
- Export success link only when output reference valid
- Permission visibility helpers use canonical `REPORTING_PERMISSIONS`
- Hidden controls ≠ security boundary
- Forbidden actor → typed failure, no crash
- No automatic role_permissions mapping in Reporting package
