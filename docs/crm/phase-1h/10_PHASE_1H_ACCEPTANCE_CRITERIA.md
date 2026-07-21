# 10 — Phase 1H Acceptance Criteria (1H-A Staging Readiness)

## In scope (1H-A)

- [x] Identity permission inventory documented
- [x] CRM permission seed authored (idempotent, catalog only)
- [x] Proposed role matrix authored (separately reviewable)
- [x] Tenant/venue resolver verdict = `SAME_SCOPE_MODEL_VERIFIED`
- [x] Phase 1G RLS certified (static)
- [x] Claim/release RPCs certified (static)
- [x] Injectable Supabase adapter behind `CrmDatabaseClientPort`
- [x] Staging migration manifest with SHA pinning
- [x] Offline preflight script
- [x] Future apply script dry-run / fail-closed
- [x] Post-apply QA design documented
- [x] Runtime composition guard (memory default; Production blocked)
- [x] Documentation under `docs/crm/phase-1h/`
- [x] Tests: `tests/crm-phase-1h-staging-readiness.test.js`

## Explicit non-goals (must remain true)

- [x] SQL not applied to Staging
- [x] SQL not applied to Production
- [x] No Staging/Production DB connection for apply
- [x] No deploy
- [x] No real credentials in repo
- [x] Durable runtime remains off
- [x] Memory composition remains default
- [x] No workers / provider delivery
- [x] No CRM UI/route changes
- [x] No commit / push / PR in this phase instruction set

## Exit verdict options

Exactly one:

- `READY_FOR_PHASE_1H_COMMIT_REVIEW`
- `READY_WITH_CONDITIONS`
- `BLOCKED_IDENTITY_CONFLICT`
- `BLOCKED_TENANT_RESOLVER`
- `BLOCKED_TEST_FAILURE`
- `BLOCKED_ARCHITECTURE_CONFLICT`
- `BLOCKED_UNSAFE`
