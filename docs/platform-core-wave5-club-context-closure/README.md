# Wave 5 — Canonical Club Context Cutover + Durable Club SQL Design

**WAVE5_STATUS=SQL_DESIGN_ROUND8_LAST_EXECUTION_GATE_REMEDIATION_COMPLETE_PENDING_ROUND9_OWNER_REVIEW**

**PC_CLUB_01=OPEN_PENDING_ACCEPTANCE** (not closed)

**PC_ADAPTER_01=CLOSED**

**PC_LEGACY_01=PARTIAL_REMEDIATED_CLUB_PATH_PENDING_DURABLE_CUTOVER**

**SQL_DESIGN_AUTHORED=YES**
**SQL_DESIGN_REVIEW_ROUND2_REMEDIATION=COMPLETE_PENDING_ROUND3_OWNER_REVIEW**
**SQL_DESIGN_REVIEW_ROUND3_REMEDIATION=COMPLETE_PENDING_ROUND4_OWNER_REVIEW**
**SQL_DESIGN_REVIEW_ROUND4_REMEDIATION=COMPLETE_PENDING_ROUND5_OWNER_REVIEW**
**SQL_DESIGN_REVIEW_ROUND5_REMEDIATION=COMPLETE_PENDING_ROUND6_OWNER_REVIEW**
**SQL_DESIGN_REVIEWED_PASS=NO**
**ROUND2_BLOCKER_01=REMEDIATED**
**ROUND2_BLOCKER_02=REMEDIATED**
**ROUND3_BLOCKER_01_INTERNAL_HELPER_PRIVILEGE=FIXED**
**ROUND3_BLOCKER_02_REGISTERED_CLUSTER_TENANT_BINDING=FIXED**
**ROUND4_BLOCKER_01_CONCURRENT_WRITE_LOCKING=FIXED**
**ROUND4_BLOCKER_02_LOCKED_APPLY_SAFETY_GATE=FIXED**
**ROUND4_P2_TRIGGER_STATE_PRESERVATION=FIXED**
**ROUND5_P1_01_PRECUTOVER_RPC_QUIESCENCE=REMEDIATED_DESIGN**
**ROUND5_P1_02_LOCK_ORDER_AND_WAIT_BOUNDING=REMEDIATED_DESIGN**
**ROUND5_P1_03_RPC_OVERWRITE_GUARD_COVERAGE=REMEDIATED_DESIGN**
**PHASE_Q1_COMMITTED_WRITE_QUIESCE=REQUIRED**
**CUTOVER_LOCK_ORDER_PARENT_TO_CHILD=YES**
**UNBOUNDED_LOCK_WAIT=NO**
**MAIN_DRIFT_CLUB_SCOPE_OVERLAP=NO**
**RECONCILIATION_REQUIRED_BEFORE_STAGING_MUTATION=YES**
**CLUB_CUTOVER_CONCURRENT_WRITE_WINDOW=CLOSED**
**APPLY_DEPENDS_ON_PRIOR_PRECHECK_FRESHNESS=NO**
**SQL_EXECUTED=NO**
**RLS_DESIGN_AUTHORED=YES**
**RLS_EXECUTED=NO**

**STAGING_MUTATED=NO**
**PRODUCTION_MUTATED=NO**
**MERGE_GO=NO**

This folder documents Wave 5 application cutover and the **design-only** durable Club Tenant migration. It does **not** claim SQL applied, Staging pass, Production pass, or `PC_CLUB_01=CLOSED`.

## Architecture lock

| Identity | Meaning |
|---|---|
| `Club.id` | Club entity identity |
| `Club.tenantId` | Canonical Platform Tenant (`platform_tenants.id`) |
| `Club.venueId` | Venue identity only when independently resolved |
| Selected Club | Preference + context target. **Not** authorization |
| Club ID | **Never** Tenant ID |
| Tenant ID | **Never** Venue ID |

No tenant↔venue cross-fill. No fabricated `default-club`. Unresolved Club is an explicit state (`CLUB_REQUIRED` / `CLUB_EMPTY` / `CLUB_CONTEXT_NOT_READY`), never silent empty business data.

## Live evidence (established, not re-queried)

| Fact | Staging `qyewbxjsiiyufanzcjcq` | Production `expuvcohlcjzvrrauvud` |
|---|---|---|
| Canonical Club flag | TRUE | TRUE |
| `clubs.tenant_id` FK | `venues(id)` | `venues(id)` |
| Club scope semantic | Legacy Venue ID stored in `tenant_id` with 1:1 Platform Tenant coincidence | same |
| Canonical Club RPC present | YES | YES |
| Distinct tenant vs venue on RPC | NO | NO |

Current durable chain:

```
platform_tenants.id
       ^
venues.tenant_id
       ^
venues.id
       ^
clubs.tenant_id   ← currently a legacy Venue scope value
```

`venues.id == venues.tenant_id == platform_tenants.id` is Wave 3 bootstrap coincidence, **not** canonical identity equivalence.

## Club ↔ Venue semantic classification

**Classification: A — obsolete tenant-alias / D — unknown legacy scope.**

Evidence:

- Phase 42B schema: `clubs.tenant_id text not null references public.venues(id)` with comment `tenant_id = venues.id (Phase A decision)`.
- No `clubs.venue_id` column exists.
- Facility registration is `clubs.registered_cluster_id`, not a Club→Venue ownership column.
- Club ↔ Venue / Cluster / Court operational access may be M:N (`court_resource` operational access). Insufficient evidence for a durable 1:1 homeVenue.

Therefore this design **does not** add `clubs.venue_id`. After migration the legacy Venue alias is discarded as Tenant authority. It is not promoted to a new persistent Club–Venue ownership relation.

## App compatibility (pre-SQL vs post-SQL)

Translator: `src/features/club/compat/legacyClubVenueScope.js`

| RPC shape | Client behavior |
|---|---|
| Explicit `scope_semantics` / `canonical_tenant_id` | Use canonical Tenant directly |
| Old shape (no marker) | Treat `row.tenant_id` as **LEGACY VENUE SCOPE**, resolve Venue, set `club.tenantId = Venue.tenantId` |

Never: `if tenant id exists in platform_tenants then assume canonical` — live Venue IDs currently equal Tenant IDs.

## SQL / RLS design

See `sql-design/`. **DO NOT RUN.** `OWNER_SQL_EXECUTION_GO=NO`.

**SQL_DESIGN_REVIEW_REMEDIATION** (Round 1, closed): strongly state-guarded APPLY; Club child tables `club_members` / `club_governance_assignments` / `club_membership_requests_v42` included; `club_create` uses `platform_tenants`; Wave 4 `tenant_members` canonical FK expected.

**SQL_DESIGN_REVIEW_ROUND2_REMEDIATION=COMPLETE_PENDING_ROUND3_OWNER_REVIEW** (not a SQL review PASS).

**ROUND2_BLOCKER_01=REMEDIATED** — APPLY no longer rewrites live RPC bodies via `pg_get_functiondef` + `regexp_replace` + `EXECUTE`. Affected member RPCs are explicit reviewed `CREATE OR REPLACE FUNCTION` bodies.

**ROUND2_BLOCKER_02=REMEDIATED** — PRECHECK fail-closes on post-Venue→Tenant name/code uniqueness collisions (`POST_MAP_DUPLICATE_CLUB_*_COUNT`) before any APPLY mutation. No auto-rename/merge.

**ATHLETE_EXISTING_REUSE_POLICY=APPROVED**
**ATHLETE_NEW_CREATE_NO_FACILITY_POLICY=FAIL_CLOSED_ATHLETE_FACILITY_VENUE_REQUIRED**

**SQL_DESIGN_REVIEW_ROUND3_REMEDIATION=COMPLETE_PENDING_ROUND4_OWNER_REVIEW** (historical Round 3 close-out; not a SQL review PASS).

**ROUND3_BLOCKER_01_INTERNAL_HELPER_PRIVILEGE=FIXED** — `wave5_ensure_athlete_for_club_member` and `wave5_resolve_club_facility_venue_id` REVOKE ALL from `public, anon, authenticated`; GRANT EXECUTE only to `service_role`. Outer Club RPCs keep authenticated EXECUTE. Nested SECURITY DEFINER calls run as the function owner.

**ROUND3_BLOCKER_02_REGISTERED_CLUSTER_TENANT_BINDING=FIXED** — PRECHECK fail-closes on `REGISTERED_CLUSTER_ORPHAN_COUNT` and `REGISTERED_CLUSTER_CROSS_TENANT_COUNT`. Legacy compares canonical Tenants via Club Venue vs Cluster Venue. Canonical/runtime compare `venues.tenant_id = clubs.tenant_id`. No `cc.venue_id = c.tenant_id` coincidence. Cross-Tenant cluster raises `ATHLETE_FACILITY_VENUE_REQUIRED: REGISTERED_CLUSTER_TENANT_MISMATCH` internally; public membership RPCs still map to `ATHLETE_FACILITY_VENUE_REQUIRED`.

**SQL_DESIGN_REVIEW_ROUND4_REMEDIATION=COMPLETE_PENDING_ROUND5_OWNER_REVIEW** (not a SQL review PASS).

**ROUND4_BLOCKER_01_CONCURRENT_WRITE_LOCKING=FIXED** — APPLY takes `LOCK TABLE` on Club-owned write tables in `ACCESS EXCLUSIVE` (deterministic order: clubs, club_members, club_governance_assignments, club_membership_requests_v42) before classification, mapping, or mutation. Row-level `FOR UPDATE` is not the cutover concurrency authority. `CLUB_CUTOVER_CONCURRENT_WRITE_WINDOW=CLOSED`.

**ROUND4_BLOCKER_02_LOCKED_APPLY_SAFETY_GATE=FIXED** — APPLY reasserts FK state, Wave 4 `tenant_members` expectation, mapping, child consistency, name/code collision, registered-cluster orphan/cross-Tenant, and RPC exact signatures **inside the locked transaction**. `APPLY_DEPENDS_ON_PRIOR_PRECHECK_FRESHNESS=NO`. `01_PRECHECK` remains operator-facing dry-run only.

**ROUND4_P2_TRIGGER_STATE_PRESERVATION=FIXED** — capture `pg_trigger.tgenabled` (`O`/`D`/`R`/`A`) and restore that exact mode after translation. No unconditional `ENABLE TRIGGER`.

**SQL_DESIGN_REVIEW_ROUND8_REMEDIATION=COMPLETE_PENDING_ROUND9_OWNER_REVIEW** (not a SQL review PASS).

**ROUND8_P1_01_MUTATION_SURFACE_TOCTOU_AFTER_DRAIN=REMEDIATED_DESIGN** — Q1B, 07B2, APPLY prelock, and 03B reassert unknown overload = 0. APPLY prelock rechecks all 14 canonical signatures and PUBLIC/anon/authenticated/service_role EXECUTE before table locks. `APPLY_DEPENDS_ON_STALE_QUIESCE_EVIDENCE=NO`.

**ROUND8_P1_02_PRE_QUIESCE_DIRECT_DB_SESSION_DRAIN_GAP=REMEDIATED_DESIGN** — 07B/07B2 fail closed on any non-current transaction with `xact_start <= quiesce_visible_at` unless `backend_type` is an explicit harmless system class. Named SQL users are not exempt. Do not auto-terminate.

**ROUND8_P1_03_CONTROL_PLANE_SCHEMA_GUARD_NOT_EXACT=REMEDIATED_DESIGN** — batch PK is exactly `(batch_id)`; snapshot PK/FK/ON DELETE RESTRICT/ON UPDATE RESTRICT certified; one-active unique index key is exactly `cutover_kind` with RESTORED/ABORTED predicate tokens.

**ROUND8_P2_01_VERIFIED_GATE_EXACT_RPC_IDENTITY=REMEDIATED_DESIGN** — 03B uses exact `regprocedure` for `phase42_club_canonical(text)` and `club_create(...)` with `overload_count=1`. Unknown mutation overload aborts VERIFIED.

**ROUND8_P2_02_LEGACY_ACL_RESTORE_FINAL_EXACTNESS=REMEDIATED_DESIGN** — 07C after snapshot replay requires caller-role ACL to equal captured snapshot. Drift rolls back and keeps writes quiesced.

**SQL_DESIGN_REVIEW_ROUND7_REMEDIATION=COMPLETE_PENDING_ROUND8_OWNER_REVIEW** (not a SQL review PASS).

**ROUND7_P1_01_Q1_COMMIT_VISIBILITY_TIMESTAMP_RACE=REMEDIATED_DESIGN** — Q1A COMMITs REVOKE in `PREPARED`. Q1B post-commit seal writes `quiesce_visible_at` and marks `QUIESCED`. Drain uses that barrier, not a pre-commit `q1_committed_at`.

**ROUND7_P1_02_SERVICE_ROLE_MUTATION_QUIESCE_GAP=REMEDIATED_DESIGN** — Q1 REVOKEs `service_role` EXECUTE on writer-capable mutation entrypoints if present (`QUIESCE_IF_PRESENT`) and does not globally revoke `service_role`. Internal helper EXECUTE is preserved.

**ROUND7_P1_03_VERIFIED_STATE_GATE_NOT_DURABLY_PROVEN=REMEDIATED_DESIGN** — `03B` rechecks 4 canonical FKs, tenant consistency, helpers, and all 14 quiesced mutation RPCs in the same transaction before `VERIFIED`. A 3-RPC subset cannot manufacture `VERIFIED`.

**ROUND7_P1_04_POST_APPLY_LEGACY_ACL_RESTORE_UNSAFE=REMEDIATED_DESIGN** — `07C` allowed only from `PREPARED` / `QUIESCED` / `DRAINED`. `POST_APPLY_LEGACY_ACL_RESTORE=DENIED`. Failed APPLY remains `DRAINED`. Post-APPLY VERIFY failure keeps writes quiesced.

**ROUND7_P1_05_RPC_SECURITY_FINGERPRINT_INCOMPLETE=REMEDIATED_DESIGN** — PRECHECK/APPLY inspect `provolatile` and SECURITY DEFINER owner. Live certification remains required. Hashes are not invented.

**ROUND7_P2_01_POST_CUTOVER_ACL_NORMALIZATION=REMEDIATED_DESIGN** — `07D` REVOKEs then GRANTs authenticated without GRANT OPTION.

**SQL_DESIGN_REVIEW_ROUND6_REMEDIATION=COMPLETE_PENDING_ROUND7_OWNER_REVIEW** (historical Round 6 close-out; not a SQL review PASS).

**ROUND6_P1_01_QUIESCE_SIGNATURE_AND_OVERLOAD_COVERAGE=REMEDIATED_DESIGN** — 14 canonical signatures must be present before Q1; unknown overloads abort; legacy `club_leave_my_membership()` is classified separately (`CANONICAL_COMMAND_SURFACE=NO`, `POST_CANONICAL_RESTORE=NO`).

**ROUND6_P1_02_DRAIN_PROOF_BATCH_BINDING=REMEDIATED_DESIGN** — drain is bound to explicit `batch_id`; 07B2 rechecks then marks `DRAINED`; APPLY requires durable DRAINED + matching batch_id; `wave5.drain_pass=YES` alone is not sufficient.

**ROUND6_P1_03_CUTOVER_CONTROL_STATE_AND_ACL_SNAPSHOT_SECURITY=REMEDIATED_DESIGN** — `wave5_club_cutover_batch` state machine; one active batch; metadata `REVOKE ALL` from PUBLIC/anon/authenticated.

**ROUND6_P1_04_RPC_BODY_CERTIFICATION_STRENGTH=REMEDIATED_DESIGN** — existing overwrites require `md5(prosrc)` plus attributes. Live fingerprints are **not** invented; `RPC_FINGERPRINT_LIVE_CERTIFICATION_REQUIRED=YES`.

**SQL_DESIGN_REVIEW_ROUND5_REMEDIATION=COMPLETE_PENDING_ROUND6_OWNER_REVIEW** (historical Round 5 close-out; not a SQL review PASS).

**ROUND5_P1_01_PRECUTOVER_RPC_QUIESCENCE=REMEDIATED_DESIGN** — committed Q1 REVOKE of 14 canonical Club mutation EXECUTE privileges (`07A`) before APPLY. Drain proof (`07B` / `07B2`) required. APPLY aborts unless durable DRAINED batch matches. Fail-closed: APPLY rollback leaves RPCs quiesced; `07C` restores exact captured ACLs for an explicit batch_id only.

**ROUND5_P1_02_LOCK_ORDER_AND_WAIT_BOUNDING=REMEDIATED_DESIGN** — lock `platform_tenants`, `venues`, `court_clusters`, then `tenant_members` (ACCESS SHARE), then Club parent/children ACCESS EXCLUSIVE. Staging lock_timeout **5s** / Production **15s** via reviewed wrappers. Deterministic order is not a deadlock-freedom claim.

**ROUND5_P1_03_RPC_OVERWRITE_GUARD_COVERAGE=REMEDIATED_DESIGN** — every APPLY `CREATE OR REPLACE FUNCTION` is inventoried (`08_`). Existing RPCs require certified markers + overload count. Unknown body → `WAVE5_APPLY_ABORT_RPC_BODY_DRIFT`. New Wave5 helpers abort if an unexpected body already exists.

**ATHLETE_NO_CLUSTER_POLICY=reuse existing athlete if any (Participant user_id uniqueness; Venue not required for reuse); else require Club.registered_cluster_id → court_clusters.venue_id → venues.id with venues.tenant_id = clubs.tenant_id; else fail closed ATHLETE_FACILITY_VENUE_REQUIRED. No Tenant-as-Venue, no first/default Venue, no clubs.venue_id, no profiles.venue_id from the Wave 5 wrapper.**

**TENANT_MEMBERS_WAVE4_CANONICAL_FK_EXPECTED=YES**
**WAVE4_SQL_REEXECUTION_REQUIRED=NO**

## Competition leftovers (not Wave 5 blockers)

| Path | Classification |
|---|---|
| `src/legacy/Tournament.jsx` | `DEAD_CODE_ONLY` — no production importer; lint-baseline only |
| `useTournamentEngine` `tenantId: activeClubId` | `AUDIT_METADATA_ONLY` — event metadata, not authorization scope |

`SEPARATE_COMPETITION_AUTHORITY_GAP=NO`. Documented as P2/P3 Competition debt. Not modified under Platform Core Wave 5.

## Explicit non-scope

- Frozen Competition Contracts 01–16 / no Contract #17
- Court contract / Referee contract unchanged
- Wave 4 deferred: Identity RPC canonical scope, `user_tenant_id` venue fallback retire, global `phase42_is_tenant_member` retirement, tenant member directory
- Organization runtime
- Tournament feature redesign / Competition Core
- Env mutation, Staging/Production mutation, deploy, merge

## Test matrix

See `tests/platform-core-wave5-club-context-closure.test.js` groups A–R.

## Future gates (not this pass)

1. Owner SQL design review
2. Separate `SQL_EXECUTION_GO` naming this package and `TARGET_ENV=staging`
3. Staging acceptance
4. Production cutover prerequisites
5. Only then consider `PC_CLUB_01=CLOSED`
