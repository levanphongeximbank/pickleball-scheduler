# Phase TT-1B — RPC overload audit

**Date:** 2026-07-11  
**Scope:** Staging + client codebase (not Production)

## Problem

Phase 23C deployed 4-parameter RPCs. Phase TT-1B added 6-parameter overloads with `p_expected_version` and `p_idempotency_key`. PostgREST can resolve the wrong overload if clients omit TT-1B parameters.

## Client audit (2026-07-11)

| Location | RPC | Before | After TT-1B.5 closeout |
|----------|-----|--------|------------------------|
| `src/features/team-tournament/services/teamTournamentRpcService.js` | submit / lock / publish / confirm / forfeit | 23C signatures | **Always** passes `p_expected_version` + `p_idempotency_key` via `buildTt1bCommandRpcArgs()` |
| `src/features/team-tournament/services/teamTournamentCloudSync.js` | submit / lock / publish / confirm | Positional 23C | Object params + auto `createTeamTournamentIdempotencyKey()` |
| `src/features/team-tournament/repositories/cloudTeamTournamentRepository.js` | submit / lock / publish / confirm / forfeit | Via RPC service | Unchanged — forwards `expectedVersion` / `idempotencyKey` in payload |
| `scripts/verify-team-tournament-cloud-staging.mjs` | lock / publish | 2-param | **6-param explicit** |
| `scripts/verify-phase-tt1b5-staging.mjs` | all TT-1B probes | — | **6-param explicit** |
| `tests/team-tournament-cloud.test.js` | mock handlers | Name-only | No runtime PostgREST — mocks unchanged |
| Production UI pages | — | No direct RPC | **No UI/runtime change in TT-1B.5** |

**No other runtime callers** of `team_tournament_submit_lineup`, `team_tournament_lock_matchup`, or `team_tournament_publish_matchup` found in `src/`.

## Recommended safe approach (approved for TT-1C prep)

**Phase 1 (now — TT-1B.5): Option C-lite**

- Keep both DB overloads (no DROP / no REVOKE yet).
- All app and QA clients **must** pass both TT-1B parameters explicitly (use `null` when unused) so PostgREST selects the 6-arg function.
- Enforced by `buildTt1bCommandRpcArgs()` + `tests/team-tournament-rpc-overload.test.js`.

**Phase 2 (after TT-1C runtime switch + staging soak)**

- Re-audit logs / callers.
- Then either:
  - **(a)** Rename TT-1B functions to `*_v2` and migrate clients, or
  - **(b)** `REVOKE EXECUTE` on 23C overloads from `authenticated` once zero callers confirmed, or
  - **(c)** Replace both with a single wrapper RPC.

**Do not DROP 23C overloads on Production** until TT-1C is live and 23C callers are proven zero.

## Staging DB state

Both overloads exist on `qyewbxjsiiyufanzcjcq`:

- `team_tournament_submit_lineup(text, text, text, jsonb)` — Phase 23C
- `team_tournament_submit_lineup(..., integer, text)` — TT-1B

Same pattern for `lock_matchup` and `publish_matchup`.

## Verification

- Unit: `npm run test:team-tournament-tt1b` (includes `team-tournament-rpc-overload.test.js`)
- Staging: `npm run verify:phase-tt1b5-staging`
