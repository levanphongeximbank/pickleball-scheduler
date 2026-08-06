# 09 — Test and Real Constraint Coverage Plan

## Mandate

**No mocked-only approval.** Real Postgres CHECK/RLS/RPC/immutability coverage and Staging rehearsal (including **mandatory** Auth-ban rehearsal) are required before any future Production GO.

## Unit tests

| Area | Assertions |
|------|------------|
| Eligibility / AuthZ gates | Certified email, exclusions, hashes, project-ref, retired GO/batch rejected |
| Engine ordering | prepare → Auth ban → readback → activate → readback; no profiles.status writes |
| Boundary compensations | All five boundaries; especially Boundary 3 |
| Idempotency / version guards | lifecycle_version conflicts fail closed |
| Filter helper | Activated-authority canonical read; dual-read temporary |
| Masking | No secrets / unmasked sensitive ids in shareable logs |

## Integration tests

- Full prepare→activate→release round trip
- Wrong project ref fail-closed
- **Anti-N+1:** paginated directory/list asserts `MAX_QUARANTINE_AUTHORITY_QUERIES_PER_PAGE = 1` (O(1) vs row count)

## Real Postgres constraint tests

Against DB with real `profiles_status_check` and new authority table:

1. Prepare pending row; `profiles.status` stays legal
2. `UPDATE profiles SET status='quarantined'` still fails CHECK
3. Active success CHECK: cannot set `lifecycle_state='active'` unless `auth_ban_state in ('applied','not_required_preexisting')`
4. Second active row same profile fails unique partial index
5. `profile_id ≠ auth_user_id` fails
6. Release consistency enforced
7. `original_profile_status='quarantined'` insert fails

## Immutability / service-role tests (mandatory)

- Trigger rejects UPDATE of `profile_id`, `auth_user_id`, `batch_id`, `original_auth_banned`, `original_profile_status`, `created_at`, `created_by`, `reason`, artifact hashes
- Same rejection when executed as **service_role**
- Hard DELETE denied in normal ops path
- Controlled RPC transitions still succeed for lifecycle fields

## RLS / writer RPC tests

- anon/authenticated direct DML denied
- prepare/activate/fail/release AuthZ positive/negative
- RPC never updates `profiles.status`
- Optimistic concurrency mismatch returns fail-closed code

## Fault-injection test — Boundary 3 (mandatory)

Simulate deterministically:

1. `qa_quarantine_prepare` succeeds
2. Auth ban succeeds
3. Activation writer fails

Expected result:

- Immediate unban compensation (because originally unbanned)
- Verified original Auth state restored
- No active quarantine
- Authority retained as `reverted` or `failed` (append-only)
- Batch and GO consumed
- No retry with the same authority / same consumed GO/batch
- If unban or failure recording unverifiable → **critical** verdict

Also cover Boundary 1, 2, 4, and 5 classification paths.

## Staging schema / service-role / SUPER_ADMIN / tenant tests

As previously required, plus immutability and set-based read RPC/view presence.

## Idempotency / rollback / drift / exact-eight / exclusion / real-user tests

Retain prior coverage. Exclusion includes lookalike `phase1b-smith@gmail.com` only as documented fixture — no private Production identity dumps.

Release unban assertions:

```text
unban iff auth_ban_state='applied' AND original_auth_banned=false
```

## Anti-N+1 query-count tests

Integration tests for directory/roster/admin list:

- Inject N quarantined + M real profiles on one page
- Assert quarantine authority query count remains 1 (bounded O(1))
- Fail if per-row queries detected

## Regression coverage for `profiles.status`

Spot-check auth/RBAC/identity admin/player adapters with `active|suspended|invited` only.

## Approval rule

| Evidence | Sufficient for Production GO? |
|----------|-------------------------------|
| Mocked unit tests only | **NO** |
| Real CHECK + immutability + Boundary 3 fault injection | Necessary, not sufficient |
| Staging apply+rollback+reapply+**mandatory Auth-ban rehearsal**+readback | Required (doc 10) |
| Fresh auth protocol (doc 11) | Required |
