# E2E-06 — Legacy Reuse Map

| Surface | Classification | Notes |
|---------|----------------|-------|
| CORE-19 Workflow | REUSE_AS_IS | Handoff only; no parallel workflow |
| CORE-20 Audit | REUSE_WITH_ADAPTER | Evidence handoff via sanitize/fingerprint |
| CORE-21 Seed & Replay | REUSE_WITH_ADAPTER | Readiness/plan fingerprint only |
| CORE-22 Import/Export | REUSE_WITH_ADAPTER | Readiness gates; no file I/O |
| CORE-23 Recovery | REUSE_WITH_ADAPTER | Readiness; no direct resume mutation |
| CM-06 Publication | REUSE_AS_IS | Publication readiness projection |
| CM-07 Suspension/Cancellation | REUSE_AS_IS | Lifecycle consistency + suspended health |
| CM-08 Archive | REUSE_AS_IS | Archive readiness; no delete/purge |
| E2E-01 Identity ports | REUSE_AS_IS | Authz fail-closed |
| E2E-03 Organizer facade | REUSE_AS_IS | Consume; do not edit |
| E2E-04 Player/Referee | REUSE_AS_IS | Consume; contracts frozen |
| E2E-05 Public Experience | REUSE_AS_IS | Consume; no private governance leak |
| `AuditLogPage` | OUT_OF_SCOPE | Identity/UI legacy; not CE governance SoT |
| `AdminIntegrationMonitoringPage` | OUT_OF_SCOPE | Platform/admin UI |
| `OperationsMobileDashboardPage` | OUT_OF_SCOPE | Mobile ops UI |
| `RealtimeConnectionStatus` | OUT_OF_SCOPE | Transport status |
| `tournamentClosingEngine` | LEGACY_MOCK / HARDEN later | Not reused as SoT |
| `resultPropagationEngine` | OUT_OF_SCOPE | Legacy tournament path |
| `publishScheduleEngine` | OUT_OF_SCOPE | Legacy; CM-06 is canonical |
| `tournamentService` | OUT_OF_SCOPE | Legacy service layer |
| `matchLiveSync` | OUT_OF_SCOPE | Live transport |
| Platform Governance incident | OUT_OF_SCOPE | PGO owns platform incidents |
| Notification/error monitoring adapters | OUT_OF_SCOPE | Not CE governance runtime |

No wholesale rewrites. New boundary lives under `operations/governance/**`.
