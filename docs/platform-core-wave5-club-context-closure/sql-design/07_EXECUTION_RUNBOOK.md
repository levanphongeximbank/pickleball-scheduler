# Wave 5 Club cutover — execution runbook (design only)

```
WAVE5_SQL_DESIGN_ONLY
OWNER_SQL_EXECUTION_GO=NO
DO_NOT_RUN_ON_STAGING
DO_NOT_RUN_ON_PRODUCTION
SQL_EXECUTED=NO
RLS_EXECUTED=NO
STAGING_PRECHECK_EXECUTED=NO
```

Do **not** execute this runbook. Do **not** run `10A` / `07A` / `07A2` / `07B` / `07B2` / `07C` / `07D` / `02_APPLY_DESIGN.sql` until Owner issues a separate `SQL_EXECUTION_GO` naming this package and `TARGET_ENV`.

```
PHASE_Q1_COMMITTED_WRITE_QUIESCE=REQUIRED
QUIESCE_COMMITTED_PHASE_DESIGNED=YES
Q0A_PRECEDES_Q1A=YES
SERVICE_ROLE_DIRECT_DML_GUARD_DESIGNED=YES
APPLY_SAME_TRANSACTION_REVOKE_VISIBLE_TO_CLIENTS=NO
UNBOUNDED_LOCK_WAIT=NO
CUTOVER_LOCK_ORDER_PARENT_TO_CHILD=YES
LOCK_ORDER_INVERSION_REVIEW=PASS
MUTATION_RPC_PRE_PRIVILEGES_CAPTURED=YES
FAIL_CLOSED_WHILE_QUIESCED=YES
RECONCILIATION_REQUIRED_BEFORE_STAGING_MUTATION=YES
MAIN_DRIFT_CLUB_SCOPE_OVERLAP=NO
PLATFORM_DEFAULT_TABLE_PRIVILEGE_HARDENING_GAP=OPEN_SEPARATE_SCOPE
```

## Why ACCESS EXCLUSIVE is not enough

`LOCK TABLE ... ACCESS EXCLUSIVE` on Club-owned tables blocks new DML **after the lock is acquired**. It does not:

1. Stop PostgREST from **accepting** new `authenticated` RPC calls while APPLY is waiting for the lock.
2. Make a `REVOKE` issued **inside** the APPLY transaction visible to other sessions before `COMMIT`.
3. Prove in-flight SECURITY DEFINER calls that already started have finished.
4. Stop `service_role` direct SQL DML on Club tables (Q0A table-privilege revoke is required for that class).

Therefore Q0A (committed `service_role` table DML REVOKE + PREPARED batch) + Q1 (committed RPC REVOKE) + drain proof are mandatory **before** APPLY starts.

## Operator sequence (when GO exists — not now)

| Step | Artifact | Commits? | Purpose |
|---|---|---|---|
| 0 | Owner GO + TARGET_ENV | n/a | Only then continue |
| 0a | `10A_SERVICE_ROLE_DML_QUIESCE_DESIGN.sql` | YES (Q0A) | Create single PREPARED batch; snapshot + REVOKE `service_role` Club table I/U/D/TRUNCATE; COMMIT; note `batch_id` |
| 0a2 | Optional `10B_SERVICE_ROLE_DML_VERIFY_DESIGN.sql` | NO | Read-only confirm snapshot + effective DENIED |
| 0b | Session GUC | n/a | `SET wave5.cutover_batch_id` to the Q0A batch |
| 1 | `07A_QUIESCE_WRITES_DESIGN.sql` | YES (Q1A) | Require existing PREPARED + Q0A guard; RPC ACL snapshot; REVOKE mutation caller roles including `service_role` if present; COMMIT |
| 1b | `07A2_QUIESCE_SEAL_DESIGN.sql` | YES (Q1B) | Same `batch_id`; prove RPC + direct DML revoke still holds; PREPARED → QUIESCED; set `quiesce_visible_at` |
| 2 | `07B_DRAIN_VERIFY.sql` | NO | Read-only drain + pre-quiesce inflight barrier on `quiesce_visible_at`; requires `wave5.cutover_batch_id` |
| 2b | `07B2_MARK_DRAINED_DESIGN.sql` | YES | Recheck drain in-transaction; QUIESCED → DRAINED |
| 3 | Session GUC | n/a | Confirm `wave5.cutover_batch_id`. `wave5.drain_pass=YES` is **not** APPLY authority |
| 3b | Staging or Production wrapper | n/a | `02_APPLY_STAGING_WRAPPER.sql` (`target_env=staging`) or `02_APPLY_PRODUCTION_WRAPPER.sql` |
| 4 | `02_APPLY_DESIGN.sql` | YES or ROLLBACK | Requires durable DRAINED + matching batch_id; prelock reasserts `service_role` DML DENIED; bounded parent→child locks; locked safety gate |
| 5 | `03_VERIFY.sql` (default / quiesced) | NO | Canonical FK/RPC bodies; all 14 mutation EXECUTE still DENIED; helpers DENIED; while quiesced `service_role` Club table DML still DENIED |
| 5b | `03B_MARK_VERIFIED_DESIGN.sql` | YES | Same-transaction full recheck incl. `VERIFIED_BEFORE_SERVICE_ROLE_RESTORE`; APPLIED → VERIFIED |
| 6a APPLY failed (rolled back) | keep Q1 | n/a | Durable state remains DRAINED. Do **not** auto-retry APPLY. Optional `07C` with `wave5.restore_batch_id` from DRAINED/QUIESCED/PREPARED |
| 6a2 APPLY committed + VERIFY failed | keep Q1 | n/a | KEEP_WRITES_QUIESCED=YES. Do **not** 07C. `service_role` stays quiesced. POST_APPLY_VERIFY_FAILURE_OWNER_DECISION_REQUIRED=YES. Prefer APP_ROLLBACK_KEEP_CANONICAL_DB |
| 6b APPLY+VERIFY+VERIFIED | `07D_RESTORE_INTENDED_WRITES_DESIGN.sql` | YES | Exact intended public command surface + exact `service_role` table DML from snapshot |
| 7 | `03_VERIFY.sql` with `SET wave5.verify_privileges = 'YES'` | NO | `POST_CUTOVER_MUTATION_PRIVILEGE_VERIFY_COUNT=14` |

`CLUB_MUTATION_NEW_CALLS_QUIESCED=YES` and `CLUB_MUTATION_IN_FLIGHT_DRAINED=YES` are **both** required before step 4. If drain cannot be proven: **APPLY=ABORT**.

`PRE_QUIESCE_ALL_USER_TRANSACTION_BARRIER=YES`. Drain fails closed if any non-current transaction has `xact_start <= quiesce_visible_at`, except explicit harmless `backend_type` system backends. Do **not** exempt an arbitrary named SQL user. Do **not** auto-terminate sessions. `AMBIGUOUS_NAMED_DB_SESSION=FAIL_CLOSED`.

New ordinary read transactions after quiesce are allowed. Direct Club DML from `PUBLIC` / `anon` / `authenticated` must remain denied (`DIRECT_CLUB_DML_*_REQUIRED=DENIED`; live PRECHECK fail-closed evidence, not a static git claim). `SERVICE_ROLE_DIRECT_CLUB_DML` is quiesced for the maintenance window by Q0A (`SERVICE_ROLE_DIRECT_DML_GUARD_DESIGNED=YES`). RPC `REVOKE` alone does not stop direct SQL.

## Timeouts (do not invent Production values)

| GUC | Staging | Production | Rationale |
|---|---|---|---|
| `lock_timeout` | **5s** | **15s** | Staging should fail fast. Production allows a short post-quiesce wait for residual `RowExclusiveLock` / autovacuum on mapping tables, then abort instead of waiting unbounded during a maintenance window. |
| `statement_timeout` | **60s** | **180s** | Caps the whole APPLY transaction (map + FK + RPC replace). Not a substitute for `lock_timeout`. |

`STAGING_LOCK_TIMEOUT=5s`  
`PRODUCTION_LOCK_TIMEOUT=15s`  
`STAGING_RECOMMENDED_LOCK_TIMEOUT=5s`  
`PRODUCTION_RECOMMENDED_LOCK_TIMEOUT=15s`

Do **not** `SET LOCAL lock_timeout` before APPLY. Wrappers set `wave5.target_env` only. APPLY's first statements after `BEGIN` call `set_config(..., true)` (`SET LOCAL`) from that GUC. Running APPLY without a wrapper aborts.

## Lock order (parent / supporting → Club parent → Club children)

Deterministic order after Q1:

1. `platform_tenants` — `SHARE ROW EXCLUSIVE` (parent of `venues.tenant_id` and `tenant_members.tenant_id`)
2. `venues` — `SHARE ROW EXCLUSIVE` (parent of `court_clusters.venue_id`; legacy Club map source)
3. `court_clusters` — `SHARE ROW EXCLUSIVE` (facility binding)
4. `tenant_members` — `ACCESS SHARE` (Wave 4 FK catalog only; blocks `ACCESS EXCLUSIVE` DDL; does not block entitlement DML; **after** `platform_tenants`)
5. `clubs` — `ACCESS EXCLUSIVE` (Club parent)
6. `club_members` — `ACCESS EXCLUSIVE`
7. `club_governance_assignments` — `ACCESS EXCLUSIVE`
8. `club_membership_requests_v42` — `ACCESS EXCLUSIVE`

`CUTOVER_LOCK_ORDER_PARENT_TO_CHILD=YES`

This **reduces** inversion against sessions that lock Tenant/Venue/Cluster first then Club. It does **not** prove deadlock-freedom: `DETERMINISTIC` ≠ deadlock-safe. Residual writers (service_role SQL, non-RPC jobs, vacuum) can still invert. Bounded `lock_timeout` is the fail-closed wait policy. Quiesce removes the **public Club mutation RPC** locker class.

## Fail-closed while quiesced

If Q1 commits and APPLY fails:

- APPLY transaction rolls back (`PARTIAL_CUTOVER_COMMIT_POSSIBLE=NO`).
- Do **not** auto-run APPLY again.
- Mutation entrypoints stay quiesced until Owner review.
- If Owner elects return to **pre-APPLY** app/database privileges: `07C_RESTORE_WRITES_DESIGN.sql` replays **only** the captured ACL rows (RPC EXECUTE + `service_role` Club table DML snapshot) for `wave5.restore_batch_id` from `PREPARED` / `QUIESCED` / `DRAINED`. `POST_APPLY_LEGACY_ACL_RESTORE=DENIED`. No `ORDER BY captured_at DESC LIMIT 1`. No generic `GRANT EXECUTE … TO authenticated`. No generic full-DML `GRANT` to `service_role`.

## Privilege restore after canonical VERIFY

`07D` grants the **intended Wave 5 public command surface** (explicit signatures) and restores exact captured `service_role` Club table DML from the Q0A snapshot (infrastructure capability, not Club domain authority). Internal helpers stay `authenticated EXECUTE = DENIED`. `anon` / `authenticated` Club table DML remain DENIED.

Read RPCs (`club_list_registry`, `club_list_members`, `club_get`, pending/discoverable/my-request reads) are **not** revoked in Q1.

## Main drift (read-only; do not merge)

Known `origin/main` at Round 5 start: `2fa254a90e5058d75197b0c3b909c756e01742f3` (from `e4180c4…`). Comparison indicated Daily Play Court canonical-read-path and unit-test manifest changes. **Club scope overlap = NO**.

`MERGE_ORIGIN_MAIN_GO=NO`. `RECONCILIATION_REQUIRED_BEFORE_STAGING_MUTATION=YES`.
