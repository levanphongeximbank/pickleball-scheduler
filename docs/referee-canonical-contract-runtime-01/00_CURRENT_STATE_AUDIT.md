# Current state audit — Referee canonical contract 01

Repository evidence only. No live Staging/Production schema probe in this run.

## Baseline

- Branch: `fix/referee-canonical-contract-runtime-closure-01`
- Originated from current `origin/main`
- No other worktree / PR #425 / Official / Daily Play mutation

## Matrix

CORE13_ASSIGNMENT=PRESENT (`src/features/competition-core/referee-assignment/**`) — planner, eligibility, replace, ports. Reuse as assignment domain authority.

CORE15_LIFECYCLE=PRESENT (`src/features/competition-core/matches/**`) — `applyMatchTransition`, MATCH_STATUS. Reuse as lifecycle authority.

CORE16_SCORING=PRESENT (`src/features/competition-core/scoring/**`) — format/state/event/projection/commands. Reuse as scoring authority. V5 win-condition adapter is compatibility documentation only.

CORE17_RESULT_VALIDATION=PRESENT (`src/features/competition-core/result-validation/**`) — validate/accept/supersede. Reuse as official result authority. Standings/bracket consume accepted active results only.

E2E04_REFEREE_FACADE=PRESENT (`createRefereeCompetitionOperationsFacade`) — orchestrates CORE-13 handoff + CORE-15/16/17. No parallel engine.

E2E04_PRODUCTION_WIRING=FALSE — default store is in-memory.

E2E04_STORE=IN_MEMORY (`createInMemoryRefereeOperationsStore`) — now classified TEST_DOUBLE_ONLY.

E2E04_AUTHORITY=CORE_ORCHESTRATION — facade does not infer winners.

REFEREE_V5_DOMAIN=STILL_REQUIRED for existing V5 UI/prototype path; NOT canonical scoring/lifecycle/result authority for Competition Adapter integrations.

REFEREE_V5_PERSISTENCE=REUSE_INFRASTRUCTURE — `referee_assignments`, `match_live_states`, `match_events`, `match_result_revisions`, `match_sync_mutations`.

REFEREE_V5_RPC_EDGE=REUSE_INFRASTRUCTURE (transaction shell: auth.uid, assignment, expectedVersion, idempotency). Domain transition in V5 service remains V5-B and is COMPATIBILITY_ONLY for new adapters.

REFEREE_V5_REALTIME=COMPATIBILITY_ONLY — keep for V5 UI; not required for End A contract.

REFEREE_V5_DATABASE_CONTRACT=REUSE — `state_payload` jsonb can hold CORE-15/16 snapshots. Status column mapping is translator-only. No destructive conversion.

ADAPTER_CONTRACT_EXISTS=NOW (`competition.referee.adapter.v1`) — was absent on main.

ADAPTER_REGISTRY_EXISTS=NOW (`createCompetitionRefereeAdapterRegistry`).

ADAPTER_CONFORMANCE_SUITE_EXISTS=NOW (`runCompetitionRefereeAdapterConformance`).

GENERIC_PERMISSION_COUPLING=REMOVED from E2E-04 map (was `TEAM_MATCH_RESULT_MANAGE` on result submit/correct). Team Tournament keep its own permission.

FUZZY_IDENTITY_AUTHORITY=LEGACY_TO_RETIRE in `refereeSessionService.refereeMatchesUser` (name/email). Canonical path = `actor.actorId` / auth.uid. Not deleted.

DUPLICATE_SCORING_AUTHORITY=CLASSIFIED — V5 engines COMPATIBILITY_ONLY for new CE adapter integrations. CORE-16 is canonical.

DUPLICATE_RESULT_AUTHORITY=CLASSIFIED — V5 finalize COMPATIBILITY_ONLY. CORE-17 is canonical.

## Stop-condition check

- No newer Adapter Contract on main.
- V5 schema compatible via `state_payload` (not destructive).
- Team Tournament implementation not modified.
- No Staging/Production mutation.
