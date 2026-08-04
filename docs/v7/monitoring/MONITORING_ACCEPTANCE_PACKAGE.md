# Phase 7 Monitoring Acceptance Package

Required live sources and owners:

| Signal | Threshold | Required source | Owner |
|---|---|---|---|
| HTTP 5xx | below 1%; abort at 1% for 5 minutes | Vercel runtime/observability | Release observer |
| Auth success | at least 98% | Supabase Auth logs | QA observer |
| Controlled API p95 | below 2 seconds | controlled probe timestamps | QA observer |
| Advisor ERROR | zero new | Supabase Security Advisor | Database operator |
| DB health | no stuck transaction/connection exhaustion | Supabase DB metrics/logs | Database operator |
| Queue/dead letters | no cutover-caused growth | application operations view | Release observer |

The 30-minute canary window, immediate security/integrity aborts and rollback order remain bound to `docs/v6/PHASE6_CANARY_MONITORING_ABORT_RUNBOOK.md`.

Current evidence proves the latest Vercel Production deployment is `READY` at SHA `3418821f` and that Supabase advisor feeds are reachable with live lint snapshots (`security: INFO/WARN only`, `performance: INFO/WARN only`, no `ERROR` level lints observed in this capture). Named observers are now explicit in the operator acceptance package.

Status: PASS WITH OBSERVATIONS.

Observations:

- Alert delivery route verification is documentary/tabletop evidence in this phase, not a synthetic Production alert fire test.
- Advisor WARN inventory remains open for future hardening and does not authorize Production mutation in this phase.
