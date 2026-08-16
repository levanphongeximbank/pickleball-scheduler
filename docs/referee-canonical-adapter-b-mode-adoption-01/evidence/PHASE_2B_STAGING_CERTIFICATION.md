# Phase 2B — Live Staging Application-Path Certification

**PR:** #439  
**Pre-cert harness HEAD:** `f3556ac0abdaf2c9973dad7f3a71c51f7bd89acf`  
**Staging project:** `qyewbxjsiiyufanzcjcq`  
**Fixture prefix:** `CE_ADAPTER_B_CERT`  
**Verdict:** `STAGING_APPLICATION_PATH_CERTIFIED`

## Scope

Live certification of canonical default composition:

`createDefaultCompetitionRefereeRuntime({ rpcClient })` with Adapter B enabled for DAILY_PLAY, INTERNAL, OFFICIAL, TEAM.

No Production mutation. No merge. No Referee UI. No schema migration.

## Results

All four modes PASS for Adapter B selection, assignment enforcement, cross-tenant deny, CAS, stale deny, idempotency, CORE-17 accept authority, fresh durable reconstruct, and no silent legacy fallback.

TEAM additionally PASS for parent matchup SSOT, child override, DreamBreaker inheritance, no duplicate DreamBreaker assignment, and Team-domain DreamBreaker rotation authority.

## Security

- Service-role used only in Node cert host
- Vite/browser service-role env rejected by composition guard
- Internal commit RPCs: anon/authenticated EXECUTE = false; service_role = true

## Cleanup

Append-only `match_events` required Staging MCP prefix-scoped DML (`session_replication_role=replica`) after service-role deletes of mutations/live/assignments.

`FIXTURE_ROWS_REMAINING=0`  
`STAGING_TEARDOWN_SQL_DML=YES_PREFIX_SCOPED`  
`PRODUCT_RUNTIME_SQL_BYPASS=NO`

## Flag

`stagingBackendCertified=true` after this certification.
