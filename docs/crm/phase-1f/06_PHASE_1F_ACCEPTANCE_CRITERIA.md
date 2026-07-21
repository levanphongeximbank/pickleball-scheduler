# 06 — Phase 1F Acceptance Criteria

**Status:** Checklist

---

## Tags

- [x] Public facade exports Tag models, constants, repositories, services
- [x] Tag creation with normalized unique code per tenant/venue
- [x] Activate / deactivate with audit events
- [x] Assign / remove on ContactReference, Lead, Opportunity
- [x] Duplicate assignment idempotent
- [x] Cross-scope target rejection
- [x] Deterministic tag and assignment listing
- [x] Fail-closed authorization

## Consent

- [x] Grant and revoke append-only records
- [x] ContactReference required in same scope
- [x] Channel / purpose / policyVersion validation
- [x] `expiresAt` after `effectiveAt` when present
- [x] Deterministic effective consent evaluation
- [x] Expired consent excluded from effective state
- [x] Pending audit events on grant/revoke

## Pending event dispatch

- [x] Enqueue validated application events
- [x] Safe payload validation (no secrets)
- [x] Deterministic list and claim ordering
- [x] Tenant/venue isolation and instance isolation
- [x] Claim limit, attempt count increment, no double-claim
- [x] Acknowledge / fail status guards
- [x] Release expired claims
- [x] No Notification / Email / SMS / Push side effects
- [x] Failure leaves no partial write

## Regression

- [x] Phase 1B–1E tests remain green
- [x] CRM menu remains PARTIAL
- [x] No other workstream files modified
- [x] No SQL / Supabase / deploy

## Verdict gate

Owner commit review required before merge. No commit/push/PR from implementation agent.
