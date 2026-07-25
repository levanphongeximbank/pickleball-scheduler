# REPORTING-05 — Accepted Residuals, Production Readiness & Next-Step Rules

## Accepted residuals

### 1. Canonical live I&A projection — `ACCEPTED_EXTERNAL_DEPENDENCY_HANDOFF`

| Field | Value |
|-------|-------|
| Behavior today | `PROJECTION_SOURCE_NOT_DEPLOYED` → typed `UNAVAILABLE` |
| Adapter | `createIntelligenceProjectionDataSourcePort` |
| Import rule | public `intelligence-analytics/index.js` only |
| Must not | fabricate projection, silent mock, false LIVE |

**Next-step rule:** When I&A publishes a public `executeByProjectionId` (or equivalent) contract and deploys the remote projection object, a **separate** workstream may inject `iaProjectionExecutor` into the Reporting adapter and add regression tests. Do not deep-import I&A internals.

### 2. Durable browser Reporting runtime — typed UNAVAILABLE

| Field | Value |
|-------|-------|
| Behavior today | `REPORTING_RUNTIME_NOT_INJECTED` / presentation `UNAVAILABLE` |
| APIs | `injectReportingAnalyticsRuntime`, `resolveReportingAnalyticsRuntime` |
| Must not | browser `service_role`, localStorage durability, memory as production SoT, mock success |

**Next-step rule:** Composition root may inject a facade backed by a **server-trusted** database client adapter. Keep presentation fail-closed until inject exists.

### 3. Production rollout — separate gate

Classification: **READY_WITH_EXPLICIT_PRECONDITIONS**

Minimum preconditions:

1. Production backup + rollback mechanism verified
2. Environment-specific project identity check (refuse Staging ref on Production)
3. Authenticated production write channel (no browser service-role)
4. SQL apply manifest + verification + rollback scripts executed under Owner GO
5. Monitoring / observability hooks agreed
6. Owner decision on `role_permissions` matrix for `reporting.*`
7. Browser runtime composition completed safely
8. Live I&A projection availability (or explicit continued UNAVAILABLE acceptance)
9. Operational support / runbook owners assigned

**Production untouched** by REPORTING-01…05 closure.

### 4. Menu visibility permissions (presentation)

Sidebar/route guards may still reference legacy `STATISTICS_VIEW` / `FINANCE_VIEW`. Service authorization uses canonical `reporting.*`. Hidden UI is **not** a security boundary. Identity Owner applies mappings separately (currently zero automatic mappings — intentional).

## What is NOT an accepted residual

- Silent live→mock fallback
- Fake export URLs accepted as success
- Reporting owning I&A/Statistics/Experience Channels
- Undocumented Staging/Production schema drift repair without Owner GO

## Production vs module closure

| Axis | Status |
|------|--------|
| A. Module functional closure | Recommended CLOSED after PR merge + CI green |
| B. Production rollout readiness | READY_WITH_EXPLICIT_PRECONDITIONS — **not rolled out** |
