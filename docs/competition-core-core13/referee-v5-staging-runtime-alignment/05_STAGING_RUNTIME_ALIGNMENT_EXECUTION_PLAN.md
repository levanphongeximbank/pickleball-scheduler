# Staging runtime alignment — next Owner execution gate

**THIS DOCUMENT IS A PLAN ONLY.**

`STAGING_SQL_EXECUTED=NO`
`EDGE_DEPLOYED=NO`
`REMOTE_FIXTURE_REPROVISION_EXECUTED=NO`
`LIVE_29_CASE_EXECUTED=NO`
`MERGE_PR444=NO`

Do not execute this plan until a later Owner GO:

`OWNER_GO=PR444_STAGING_RUNTIME_ALIGNMENT_EXECUTION`

Target: Staging `qyewbxjsiiyufanzcjcq` only.
Production `expuvcohlcjzvrrauvud` is denied.

## A. Referee V5 DB SQL required?

**YES**

Reason: live `START_MATCH` failed with PostgREST schema-cache miss for
`referee_v5_commit_match_transition` even though Staging `pg_proc` already
has the canonical V5D32 17-argument function. APPLY recreates that body
idempotently and issues `NOTIFY pgrst, 'reload schema'`.

Package:

`docs/competition-core-core13/referee-v5-staging-runtime-alignment/`

## B. `referee-v5-match` redeploy required?

**NO** after SQL, unless a later probe proves the deployed Edge contract
differs from repository source.

Repository source already sends the V5D32 named arguments. No Edge source
change was required in this gate.

## C. `competition-referee-assignment` redeploy required?

**YES** after this source fix.

Tenant authority is now resolved server-side from canonical tournament
context. Mutation responses now surface canonical `assignmentId`.
Idempotent uniqueness replay is normalized at the trusted command boundary.

## D. Order of operations

1. Staging SQL `01_PRECHECK.sql`
2. Staging SQL `02_APPLY.sql`
3. Staging SQL `03_VERIFY.sql`
4. Deploy **only** `competition-referee-assignment` (source changed)
5. OPTIONS / unauthenticated / invalid-JWT probes on that Edge
6. Narrow authenticated `START_MATCH` smoke on a retained or newly
   authorized disposable fixture — **separate Owner GO**
7. Reconcile partial fixture `run-cli-1776466232482` — **separate Owner GO**
8. Remote fixture reprovision — **separate Owner GO**
9. Live 29-case — **later**

Do not mutate retained partial fixtures in the SQL/Edge execution gate
unless a later Owner GO explicitly authorizes it.
