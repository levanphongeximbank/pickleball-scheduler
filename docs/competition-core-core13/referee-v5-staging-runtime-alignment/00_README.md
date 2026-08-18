# Referee V5 Staging runtime alignment

**LOCAL PACKAGE ONLY. Do NOT apply to Staging/Production without Owner GO.**

**SQL_DESIGN_AND_MIGRATION_AUTHORING_GO=YES · SQL_EXECUTION_GO=NO**

**STAGING_SQL_EXECUTED=NO · EDGE_DEPLOYED=NO · PRODUCTION_ACCESS_GO=NO**

## Why

Live CORE-13 fixture provision (`run-cli-1776466232482`) failed at Referee V5
`START_MATCH` with a PostgREST schema-cache miss for
`public.referee_v5_commit_match_transition(...)`.

Read-only Staging `pg_proc` audit on `qyewbxjsiiyufanzcjcq` (2026-08-18) found
the function **present** with the current canonical V5D32 17-argument
signature, overload count 1, `SECURITY DEFINER`,
`search_path=pg_catalog, public`, `service_role` EXECUTE only,
`anon`/`authenticated`/`public` EXECUTE denied.

Classification:

| Axis | Result |
|------|--------|
| `RPC_STATE` | `PRESENT_EXPECTED_SIGNATURE` |
| True schema absence | NO |
| PostgREST schema-cache drift | YES (live PGRST202 despite matching `pg_proc`) |
| Edge source signature drift | NO (`RefereeV5RpcAtomicCommitService` keys match V5D32) |
| Combination | PostgREST cache stale after historical DROP+CREATE; pg_proc already canonical |

V5D1 15-arg is **not** current authority. V5D32 replaced it.

## Three-way matrix — `referee_v5_commit_match_transition`

| Layer | Signature |
|-------|-----------|
| Runtime (`RefereeV5RpcAtomicCommitService` / Edge bundle) | `p_tenant_id, p_tournament_id, p_match_id, p_actor_id, p_command_type, p_command_payload, p_expected_state_version, p_expected_event_sequence, p_client_mutation_id, p_idempotency_key, p_request_hash, p_next_state, p_generated_events, p_state_before_hash, p_state_after_hash, p_state_before?, p_staging_fault?` → `jsonb` |
| Canonical SQL | `docs/v5/referee-v5/PHASE_V5D32_IDEMPOTENCY_UNDO.sql` (same 17 args) |
| Staging `pg_proc` | Present, same 17 args, overload=1 |

`START_MATCH` / SCORE / `PAUSE_MATCH` / `DECLARE_FORFEIT` share this RPC.
`FINALIZE` uses `referee_v5_commit_match_finalization` (V5D4 11-arg).
`initialize-execution` already succeeded on the partial fixture.

## Apply order (later Owner GO only)

1. `01_PRECHECK.sql` (read only)
2. `02_APPLY.sql` once, one transaction (CREATE OR REPLACE canonical bodies + `NOTIFY pgrst, 'reload schema'`)
3. `03_VERIFY.sql`
4. Do **not** redeploy `referee-v5-match` unless source changed (it did not)
5. Redeploy `competition-referee-assignment` because tenant/result-shape source changed
6. OPTIONS / unauth / invalid-JWT probes
7. Narrow authenticated `START_MATCH` smoke only under a separate Owner GO
8. Reprovision / live 29-case later — **not this gate**

## Security

| Grantee | `referee_v5_commit_match_transition` / `_finalization` |
|---------|--------------------------------------------------------|
| `anon` | DENY |
| `PUBLIC` | DENY |
| `authenticated` | DENY |
| `service_role` | ALLOW |

`SECURITY DEFINER` + locked `search_path=pg_catalog, public`.

No unrelated table DDL, RLS, or triggers.

## Rollback

Honest: this package must **not** drop the live RPCs. See `04_ROLLBACK.sql`.

## Package LF SHA256 lock

Checksums are asserted by
`tests/competition-engine-core13-referee-v5-runtime-alignment-01.test.js`.

| File | SHA256 |
|------|--------|
| `01_PRECHECK.sql` | `0ef73f6d5adcd7079c8cb8cbaa9a3814c44cf57026848ec211294367f8ee56c6` |
| `02_APPLY.sql` | `ca1e01e401347248d72e1065364ab5a794db8addc6afc07eba4eb9cfeea8730d` |
| `03_VERIFY.sql` | `6073531b791e9ec9d11214452029d74ed7edf3f6482916422788e34660451f39` |
| `04_ROLLBACK.sql` | `cad5dcc1306826101e254653496eed76bccd0ac1449014e412baae80ae2cc925` |
