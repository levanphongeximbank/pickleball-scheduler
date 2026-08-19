# Wave 5 SQL design — AUTHOR ONLY

```
WAVE5_SQL_DESIGN_ONLY
OWNER_SQL_EXECUTION_GO=NO
DO_NOT_RUN_ON_STAGING
DO_NOT_RUN_ON_PRODUCTION
SQL_EXECUTED=NO
RLS_EXECUTED=NO
```

This folder is a **reviewable design package**. Committing it must not auto-apply to any database. It is **not** a `supabase/migrations` deployment artifact.

Do not apply until Owner issues a separate execution GO naming this package and `TARGET_ENV`.

## Files

| File | Mutates? | Purpose |
|---|---|---|
| `01_PRECHECK.sql` | NO | Operator-facing read-only dry-run inventory. **Not** APPLY freshness. `APPLY_DEPENDS_ON_PRIOR_PRECHECK_FRESHNESS=NO` |
| `02_APPLY_DESIGN.sql` | YES (when GO) | Self-protecting locked transactional cutover. Reasserts mutation-critical invariants under lock before any mutation |
| `03_VERIFY.sql` | NO | Post-apply read-only invariants (cannot prove a historical `LOCK TABLE`) |
| `04_ROLLBACK_DESIGN.md` | documentation | App rollback vs DB rollback |
| `05_CLUB_TENANT_TABLE_INVENTORY.md` | documentation | Tenant-bearing table classification |
| `06_CLUB_MUTATION_RPC_INVENTORY.md` | documentation | Club mutation RPC semantics + EXECUTE privilege matrix |
| `07_EXECUTION_RUNBOOK.md` | documentation | Pre-cutover quiesce, drain, lock order, fail-closed restore |
| `07A_QUIESCE_WRITES_DESIGN.sql` | YES (when GO) | Committed Q1 REVOKE of mutation EXECUTE + cutover batch |
| `07B_DRAIN_VERIFY.sql` | NO | Read-only drain + pre-Q1 transaction barrier bound to batch_id |
| `07B2_MARK_DRAINED_DESIGN.sql` | YES (when GO) | Recheck drain in-transaction then QUIESCED → DRAINED |
| `02_APPLY_STAGING_WRAPPER.sql` | session GUC | `wave5.target_env=staging` → APPLY lock_timeout 5s |
| `02_APPLY_PRODUCTION_WRAPPER.sql` | session GUC | `wave5.target_env=production` → APPLY lock_timeout 15s |
| `03B_MARK_VERIFIED_DESIGN.sql` | YES (when GO) | APPLIED → VERIFIED after read-only 03_VERIFY |
| `07C_RESTORE_WRITES_DESIGN.sql` | YES (when GO) | Exact captured ACL replay for **explicit** batch_id only |
| `07D_RESTORE_INTENDED_WRITES_DESIGN.sql` | YES (when GO) | Intended public command surface after VERIFIED |
| `08_RPC_OVERWRITE_GUARD_INVENTORY.md` | documentation | Every APPLY CREATE OR REPLACE overwrite class |

## Schema-state machine

| State | Condition | Allowed |
|---|---|---|
| `STATE_LEGACY` | `clubs` + `club_members` + `club_governance_assignments` + `club_membership_requests_v42` `tenant_id` FK **exactly** `public.venues(id)` | materialize map, validate, translate, replace FK |
| `STATE_CANONICAL` | all four FKs **exactly** `public.platform_tenants(id)` | DO NOT translate data, DO NOT join values to `venues.id` as migration source, only rerunnable function/policy reconcile |
| `STATE_UNKNOWN` | anything else, including mixed FKs | hard abort |

`01_PRECHECK.sql` is operator-facing dry-run evidence. `02_APPLY_DESIGN.sql` is independently safe: it does not depend on PRECHECK having been run immediately before.

The DATA `UPDATE` is inside the `STATE_LEGACY` branch of the **same** `DO` block. A prior local `RETURN` cannot leak into an unconditional rewrite. `CANONICAL_STATE_DATA_TRANSLATION=DENIED`. Canonical invariant failure aborts; it does not repair.

`CANONICAL_STATE_CANNOT_EXECUTE_LEGACY_TRANSLATION=YES`

Do not use `venues.id = platform_tenants.id` as a migration predicate.

## Durable target

Club-owned `tenant_id` → `public.platform_tenants(id)` ON DELETE RESTRICT:

- `public.clubs`
- `public.club_members`
- `public.club_governance_assignments`
- `public.club_membership_requests_v42`

Algorithm when `STATE_LEGACY`: old `tenant_id` (Venue ID) → `venues.id` → `venues.tenant_id` → Platform Tenant ID. Child rows follow parent `club_id` mapping. Cross-table Club/Tenant disagreement aborts.

No `clubs.venue_id` column.

Athletes / idempotency / audit are **not** migrated. Club RPCs that ensure athletes use `wave5_ensure_athlete_for_club_member` (facility Venue from registered cluster), never Club Tenant as `venues.id`.

## Club RPC

Post-migration `p_tenant_id` / Club-owned row `tenant_id` = Platform Tenant ID.

`club_create` existence check is `public.platform_tenants(id)`. Authorization is `phase42_can_create_in_tenant` (tenant_members + Super Admin + PLAYER/CLUB_MANAGER `club.create`). Registered cluster is validated independently through Venue/Cluster topology and must not redefine Club tenant identity.

`club_list_registry` / Club SELECT RLS / `club_list_members` use `platform_is_canonical_tenant_entitled` (`tenant_members` + Super Admin). Club authz helpers drop `profiles.venue_id = c.tenant_id`.

**PHASE42_GLOBAL_HELPER_RETIREMENT_INCLUDED=NO** — `phase42_is_tenant_member` is not dropped or globally rewritten.

## Wave 4 tenant_members (CLOSED — do not re-execute)

**TENANT_MEMBERS_WAVE4_CANONICAL_FK_EXPECTED=YES**

**WAVE4_SQL_REEXECUTION_REQUIRED=NO**

Wave 4 Production/Staging closed state already applied:

`tenant_members.tenant_id` → `public.platform_tenants(id)` ON DELETE RESTRICT

Wave 5 precheck **expects** that canonical FK and fails closed if the target environment unexpectedly differs. Do not rewrite Wave 4 migrations. Do not re-execute Wave 4 SQL.

## Round 2 remediation (pending Round 3 Owner SQL review)

```
SQL_DESIGN_REVIEW_ROUND2_REMEDIATION=COMPLETE_PENDING_ROUND3_OWNER_REVIEW
ROUND2_BLOCKER_01=REMEDIATED
ROUND2_BLOCKER_02=REMEDIATED
DYNAMIC_RPC_TEXT_REWRITE_PRESENT=NO
POST_MAP_NAME_COLLISION_GUARD=YES
POST_MAP_CODE_COLLISION_GUARD=YES
SQL_DESIGN_REVIEWED_PASS=NO
```

## Round 3 remediation (pending Round 4 Owner SQL review)

```
SQL_DESIGN_REVIEW_ROUND3_REMEDIATION=COMPLETE_PENDING_ROUND4_OWNER_REVIEW
ROUND3_BLOCKER_01_INTERNAL_HELPER_PRIVILEGE=FIXED
ROUND3_BLOCKER_02_REGISTERED_CLUSTER_TENANT_BINDING=FIXED
WAVE5_ATHLETE_HELPER_DIRECT_AUTHENTICATED_EXECUTE=DENY
REGISTERED_CLUSTER_ORPHAN_PRECHECK=YES
REGISTERED_CLUSTER_CROSS_TENANT_PRECHECK=YES
REGISTERED_CLUSTER_RUNTIME_TENANT_BINDING=YES
REGISTERED_CLUSTER_VERIFY=YES
ATHLETE_EXISTING_REUSE_POLICY=APPROVED
ATHLETE_NEW_CREATE_NO_FACILITY_POLICY=FAIL_CLOSED_ATHLETE_FACILITY_VENUE_REQUIRED
SQL_DESIGN_REVIEWED_PASS=NO
```

Internal Athlete/facility helpers: REVOKE ALL FROM `public, anon, authenticated`; GRANT EXECUTE TO `service_role` only (same convention as `phase42n_ensure_athlete_for_user`). Certified outer Club RPCs keep authenticated EXECUTE. SECURITY DEFINER nested calls execute as the owner.

Registered cluster: same-Tenant facility only (`venues.tenant_id = clubs.tenant_id` after cutover). Legacy precheck derives both canonical Tenants through Venue rows. Orphan and cross-Tenant counts fail closed. `club_create` `CLUSTER_TENANT_MISMATCH` is unchanged.

**ATHLETE_NO_CLUSTER_POLICY=reuse existing athlete if any (Participant user_id uniqueness; Venue not required for reuse); else require Club.registered_cluster_id → court_clusters.venue_id → venues.id with venues.tenant_id = clubs.tenant_id; else fail closed ATHLETE_FACILITY_VENUE_REQUIRED. No Tenant-as-Venue, no first/default Venue, no clubs.venue_id, no profiles.venue_id from the Wave 5 wrapper.**

`athletes.tenant_id` remains facility/Venue-scoped. Wave 5 does not migrate `athletes` onto `platform_tenants`.

PRECHECK uses `to_regprocedure` exact signatures (not `proname LIMIT 1`). `STATE_CANONICAL` uniqueness is checked on Club `tenant_id` without treating it as Venue. `STATE_LEGACY` uniqueness is checked on `venues.tenant_id` after conceptual translation. Collision classification: `DATA_RECONCILIATION_OWNER_DECISION_REQUIRED`.

## Round 4 remediation (pending Round 5 Owner SQL review)

```
SQL_DESIGN_REVIEW_ROUND4_REMEDIATION=COMPLETE_PENDING_ROUND5_OWNER_REVIEW
ROUND4_BLOCKER_01_CONCURRENT_WRITE_LOCKING=FIXED
ROUND4_BLOCKER_02_LOCKED_APPLY_SAFETY_GATE=FIXED
ROUND4_P2_TRIGGER_STATE_PRESERVATION=FIXED
CLUB_CUTOVER_TABLE_LOCK=YES
CLUB_CUTOVER_LOCK_MODE=ACCESS EXCLUSIVE
CLUB_CUTOVER_LOCK_ORDER=DETERMINISTIC
CLUB_CUTOVER_CONCURRENT_WRITE_WINDOW=CLOSED
APPLY_DEPENDS_ON_PRIOR_PRECHECK_FRESHNESS=NO
APPLY_IN_TRANSACTION_FK_STATE_GUARD=YES
APPLY_EXPECTS_WAVE4_TENANT_MEMBERS_CANONICAL=YES
APPLY_IN_TRANSACTION_MAPPING_GUARD=YES
APPLY_IN_TRANSACTION_CHILD_CONSISTENCY_GUARD=YES
APPLY_IN_TRANSACTION_NAME_COLLISION_GUARD=YES
APPLY_IN_TRANSACTION_CODE_COLLISION_GUARD=YES
APPLY_IN_TRANSACTION_CLUSTER_ORPHAN_GUARD=YES
APPLY_IN_TRANSACTION_CLUSTER_CROSS_TENANT_GUARD=YES
APPLY_IN_TRANSACTION_RPC_SIGNATURE_GUARD=YES
APPLY_RPC_UNKNOWN_NEWER_BODY_OVERWRITE=DENIED
CANONICAL_STATE_DATA_TRANSLATION=DENIED
TRIGGER_PRE_STATE_CAPTURED=YES
TRIGGER_POST_STATE_PRESERVED=YES
PARTIAL_CUTOVER_COMMIT_POSSIBLE=NO
SQL_DESIGN_REVIEWED_PASS=NO
```

Club-owned tables are locked in one `LOCK TABLE ... ACCESS EXCLUSIVE` statement before FK classification, mapping, uniqueness, `DROP CONSTRAINT`, `UPDATE`, or RPC replacement. Supporting mapping tables (`venues`, `platform_tenants`, `court_clusters`) use `SHARE ROW EXCLUSIVE` so mapping keys cannot change while ordinary `SELECT` continues. `tenant_members` uses `ACCESS SHARE` to block DDL of the Wave 4 FK without blocking entitlement DML.

APPLY-time `pg_get_functiondef` is read-only validation. It is never `EXECUTE`d or `regexp_replace`d into a replacement body.

`trg_phase42_gov_active_member` enablement is captured from `pg_trigger.tgenabled` (`O`/`D`/`R`/`A`) and restored exactly after translation. One transaction; no internal `COMMIT`.

## Round 5 remediation (pending Round 6 Owner SQL review)

```
SQL_DESIGN_REVIEW_ROUND5_REMEDIATION=COMPLETE_PENDING_ROUND6_OWNER_REVIEW
ROUND5_P1_01_PRECUTOVER_RPC_QUIESCENCE=REMEDIATED_DESIGN
ROUND5_P1_02_LOCK_ORDER_AND_WAIT_BOUNDING=REMEDIATED_DESIGN
ROUND5_P1_03_RPC_OVERWRITE_GUARD_COVERAGE=REMEDIATED_DESIGN
PHASE_Q1_COMMITTED_WRITE_QUIESCE=REQUIRED
QUIESCE_COMMITTED_PHASE_DESIGNED=YES
MUTATION_RPC_ENTRYPOINT_COUNT=14
MUTATION_RPC_PRIVILEGE_CAPTURE=EXACT_ACL_SNAPSHOT
IN_FLIGHT_DRAIN_GATE=YES
FAIL_CLOSED_WHILE_QUIESCED=YES
CUTOVER_LOCK_ORDER_PARENT_TO_CHILD=YES
LOCK_ORDER_INVERSION_REVIEW=PASS
UNBOUNDED_LOCK_WAIT=NO
STAGING_RECOMMENDED_LOCK_TIMEOUT=5s
PRODUCTION_RECOMMENDED_LOCK_TIMEOUT=15s
APPLY_CREATE_OR_REPLACE_FUNCTION_COUNT=13
EXISTING_RPC_OVERWRITE_GUARD_COUNT=10
NEW_WAVE5_FUNCTION_GUARD_COUNT=3
UNKNOWN_RPC_BODY_OVERWRITE_DENIED=YES
INTERNAL_HELPER_AUTHENTICATED_EXECUTE=DENIED
MAIN_DRIFT_CLUB_SCOPE_OVERLAP=NO
RECONCILIATION_REQUIRED_BEFORE_STAGING_MUTATION=YES
SQL_DESIGN_REVIEWED_PASS=NO
```

Club mutation RPCs are quiesced in a **committed** Q1 (`07A`) before APPLY. APPLY aborts unless a durable `DRAINED` Wave5 Club batch matches `wave5.cutover_batch_id`. `wave5.drain_pass=YES` is not sufficient. Lock order is parent/supporting tables then Club parent then children. Lock timeouts come from reviewed Staging/Production wrappers (`5s` / `15s`). Every APPLY `CREATE OR REPLACE` of an existing function requires a strong `md5(prosrc)` fingerprint. Do not merge `origin/main` in this remediation.

## Round 6 remediation (pending Round 7 Owner SQL review)

```
SQL_DESIGN_REVIEW_ROUND6_REMEDIATION=COMPLETE_PENDING_ROUND7_OWNER_REVIEW
CANONICAL_MUTATION_RPC_COUNT=14
LEGACY_COMPAT_MUTATION_RPC_COUNT=1
TOTAL_QUIESCE_TARGET_COUNT=15
ALL_CANONICAL_MUTATION_SIGNATURES_PRESENT_BEFORE_Q1=YES
UNKNOWN_MUTATION_RPC_OVERLOAD=ABORT
ONE_ACTIVE_CUTOVER_BATCH=YES
CUTOVER_STATE_MACHINE=YES
CUTOVER_METADATA_PUBLIC_ACCESS=DENIED
CUTOVER_METADATA_AUTHENTICATED_ACCESS=DENIED
CUTOVER_METADATA_ANON_ACCESS=DENIED
RESTORE_REQUIRES_EXPLICIT_BATCH_ID=YES
LATEST_SNAPSHOT_IMPLICIT_RESTORE=DENIED
PRE_Q1_INFLIGHT_TRANSACTION_BARRIER=YES
APPLY_REQUIRES_DURABLE_DRAIN_STATE=YES
APPLY_BATCH_ID_MATCH_REQUIRED=YES
ARBITRARY_DRAIN_PASS_GUC_NOT_SUFFICIENT=YES
EXISTING_RPC_STRONG_FINGERPRINT_COUNT=10
NEW_WAVE5_FUNCTION_STRONG_GUARD_COUNT=3
RPC_FINGERPRINT_LIVE_CERTIFICATION_REQUIRED=YES
POST_CUTOVER_MUTATION_PRIVILEGE_VERIFY_COUNT=14
LEGACY_LEAVE_MY_POST_CUTOVER_STATE=QUIESCED_EXECUTE_DENIED
STAGING_LOCK_TIMEOUT=5s
PRODUCTION_LOCK_TIMEOUT=15s
UNBOUNDED_LOCK_WAIT=NO
SQL_DESIGN_REVIEWED_PASS=NO
```

Cutover control state lives in `public.wave5_club_cutover_batch` (no private operational schema exists in this architecture). Application roles are denied: `REVOKE ALL` from `PUBLIC` / `anon` / `authenticated` plus RLS with no policies. Fingerprints are **not** invented in git; PRECHECK will emit live `prosrc_md5` when Owner authorizes a read-only Staging run.
