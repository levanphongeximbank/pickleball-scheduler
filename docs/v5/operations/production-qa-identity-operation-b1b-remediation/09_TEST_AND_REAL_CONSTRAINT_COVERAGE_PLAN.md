# 09 — Test and Real Constraint Coverage Plan

## Mandate

**No mocked-only approval.** Package tests that mock writers are insufficient for Production authorization. Real Postgres CHECK/RLS/RPC coverage on Staging (or ephemeral Postgres with production-like constraints) is required before any future Production GO.

## Unit tests

| Area | Assertions |
|------|------------|
| Eligibility | Certified email, exclusions, zero refs, bind checks |
| Authorization | Missing GO/batch/hash/project-ref ⇒ zero mutations |
| Engine ordering | Authority before Auth ban; no status write calls |
| Compensation | Ban failure releases authority; never writes profiles.status |
| Idempotency | Second apply no duplicate active row semantics |
| Masking | Evidence contains no raw secrets / unmasked sensitive ids in shareable logs |
| Filter helper | Dual-read + final read behaviors |

## Integration tests

- Runner + adapter against local/supabase test harness
- Apply → verify → release → verify round trip
- Fail-closed on wrong project ref

## Real Postgres constraint tests

Must execute against a database that includes:

- `profiles` with **real** `profiles_status_check` (`active|suspended|invited`)
- New `qa_identity_quarantines` constraints and partial unique indexes

Required cases:

1. Insert authority row succeeds while `profiles.status` stays `active`
2. `UPDATE profiles SET status='quarantined'` still **fails** CHECK (regression guard)
3. Second active quarantine for same profile **fails** unique partial index
4. `profile_id ≠ auth_user_id` insert **fails**
5. Release consistency CHECK enforced
6. `original_profile_status='quarantined'` insert **fails** domain check

## Staging schema tests

After Staging migration apply:

- Table/RPC/RLS/index inventory matches plan
- `profiles_status_check` definition unchanged
- `quarantined` not present in profiles status enum/check

## RLS tests

- `anon`/`authenticated` direct INSERT/UPDATE/DELETE denied
- SUPER_ADMIN RPC apply/release allowed when AuthZ passes
- Non-admin authenticated RPC denied
- Tenant user cannot read other tenants’ rows if read path exists

## Writer RPC tests

- Apply returns active row; idempotent re-apply
- Release transitions and rejects double-release without new apply
- RPC never updates `profiles.status` (trigger/spy/row compare)

## Service-role tests

- Service-role runner path still enforces app-level GO gates
- Service-role bypass of RLS does not bypass allowlist/hash/batch gates

## SUPER_ADMIN tests

- Authenticated SUPER_ADMIN can call RPC in Staging
- SUPER_ADMIN without GO cannot run Production batch runner mutations

## Tenant isolation tests

- Venue snapshots recorded
- Cross-tenant leakage absent on any authenticated read API

## Idempotency tests

- Re-apply same batch/identity
- Re-ban when already banned
- Rollback when already released

## Rollback tests

- Batch release restores Auth correctly
- Drift aborts without mutation
- Forward GO cannot authorize rollback entrypoint

## Partial failure tests

- Authority success + ban failure ⇒ compensated release
- Compensation failure surfaces abort codes
- Subsequent identities not processed after fail-closed stop

## Drift tests

Cover each drift code in `05_ROLLBACK_AND_RECOVERY_PLAN.md`.

## Exact-eight tests

- Allowlist size ≠ 8 ⇒ refuse live mutation
- Extra identity in file ⇒ refuse
- Missing required fields ⇒ refuse

## Exclusion tests

- QA-01…QA-03 excluded
- `phase1b-smith@gmail.com` rejected
- Non-certified domains rejected

## Real-user protection tests

- Random active real-user fixture never quarantined
- Suspended real user remains `suspended` and is not “unquarantined” by QA rollback tooling
- Directory still shows real users

## Regression coverage for `profiles.status` consumers

Spot-check critical paths remain correct with `active/suspended/invited` only:

- Auth resolve rejects suspended
- RBAC helpers requiring `status='active'`
- `identity_admin_update_user` status patch still limited to legal values under CHECK
- Player adapters mapping `accountStatus`

No requirement to rewrite all ~208 consumers if proofs show they never depended on `quarantined` as a legal DB value (they should not).

## Approval rule

| Evidence | Sufficient for Production GO? |
|----------|-------------------------------|
| Unit tests with mocks only | **NO** |
| Real CHECK tests green | Necessary, not sufficient |
| Staging apply+rollback+reapply+rehearsal | Required (see doc 10) |
| Fresh auth protocol complete | Required (see doc 11) |
