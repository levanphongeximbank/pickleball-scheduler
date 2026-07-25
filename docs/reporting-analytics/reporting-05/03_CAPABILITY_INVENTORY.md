# REPORTING-05 — Capability Inventory

Classification key:

| Class | Meaning |
|-------|---------|
| COMPLETE | Capability implemented, honest, tested |
| COMPLETE_WITH_ACCEPTED_RESIDUAL | Complete fail-closed behavior; residual is external/typed |
| PARTIAL | Present but incomplete for full live ops |
| MISSING | Required and absent |
| OUT_OF_SCOPE | Explicitly excluded from module |
| OWNED_BY_OTHER_MODULE | Correctly owned elsewhere |

## Inventory

| Capability | Class | Notes |
|------------|-------|-------|
| Report definitions (contract + durable repo) | COMPLETE | Facade + `durableReportDefinitionRepository` + table |
| Saved reports lifecycle | COMPLETE | create/update/conflict via expectedVersion |
| Saved filters lifecycle | COMPLETE | create/update/invalid typed failures |
| Report executions | COMPLETE | orchestration + durable repo + lifecycle |
| Export jobs | COMPLETE | orchestration + artifact ref validation |
| Execution orchestration | COMPLETE | `application/executeReport.js` |
| Export orchestration | COMPLETE | `application/exportReport.js` |
| Provenance / availability contracts | COMPLETE | LIVE/MOCK/… + assertNoSilentLiveToMockFallback |
| Presentation source states | COMPLETE | 10 typed states + labels |
| Reporting public facade | COMPLETE | `index.js` + `REPORTING_ANALYTICS_PUBLIC_EXPORTS` |
| Operational dashboard honesty | COMPLETE_WITH_ACCEPTED_RESIDUAL | Aggregation UI remains in `dashboard-analytics` |
| `/reports` workspace | COMPLETE_WITH_ACCEPTED_RESIDUAL | Honest UNAVAILABLE without runtime inject |
| Menu / navigation leaf | COMPLETE_WITH_ACCEPTED_RESIDUAL | Path present; legacy visibility permissions |
| 10 `reporting.*` permissions (constants + seed) | COMPLETE | No auto `role_permissions` mapping |
| SQL package (tables/indexes/RLS/grants/verify/rollback) | COMPLETE | Authored under `docs/.../reporting-02/` |
| Staging live schema/RLS/auth | COMPLETE_WITH_ACCEPTED_RESIDUAL | Owner-accepted REPORTING-03 live PASS |
| I&A projection adapter | COMPLETE_WITH_ACCEPTED_RESIDUAL | Public facade only; UNAVAILABLE until deployed |
| Browser runtime composition | COMPLETE_WITH_ACCEPTED_RESIDUAL | Inject APIs exist; app root not wired |
| Durable repositories / DB port | COMPLETE | Injected client; fake client for tests |
| Accessibility (workspace/lifecycle/source) | COMPLETE | Covered by REPORTING-04 tests |
| Mock honesty under LIVE | COMPLETE | No silent live→mock |
| Analytical metric computation | OWNED_BY_OTHER_MODULE | I&A / dashboard aggregation |
| Trends / anomalies / AI insights | OWNED_BY_OTHER_MODULE | I&A / insightEngine |
| Statistics season/session truth | OWNED_BY_OTHER_MODULE | `statistics` |
| Experience Channels design system | OWNED_BY_OTHER_MODULE | Experience Channels |
| Identity role assignment | OWNED_BY_OTHER_MODULE | Identity handoff only |
| Production schema rollout | OUT_OF_SCOPE | Separate Owner gate |
| Browser service-role credential | OUT_OF_SCOPE | Forbidden |
| localStorage durable Reporting SoT | OUT_OF_SCOPE | Forbidden |

## Completeness rule

A capability is not COMPLETE merely because a file or test exists. Each COMPLETE row requires contracts + ownership + fail-closed behavior + regression coverage appropriate to the workstream that delivered it.
