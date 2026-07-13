# TT-5C — Implementation Summary

**Phase:** TT-5C Result Propagation & Consumer  
**Branch:** `feature/tt5-referee-v5-integration`  
**Base:** TT-5B commit `84810bf`  
**Staging ref:** `qyewbxjsiiyufanzcjcq`  
**Production impact:** NONE

---

## Delivered

Referee V5 finalize → outbox → Team Tournament consumer → sub-match / matchup / standings update, with exactly-once inbox, revision handling, reprovision/resync, minimal BTC UI, staging E2E.

### SQL (Staging applied)

| File | Purpose |
|------|---------|
| `TT5-C_RESULT_OUTBOX_CONSUMER.sql` | Inbox table, payload hash, event normalization |
| `TT5-C_RESULT_PROPAGATION.sql` | Map/apply result, consume/drain RPCs (service_role) |
| `TT5-C_STANDINGS_RECOMPUTE.sql` | Canonical TT-4 recompute wrapper |
| `TT5-C_REPROVISION_STATE.sql` | Snapshot stale, resync RPC, link/score ops patch |

Apply: `node scripts/apply-phase-tt5c-staging-sql.mjs`  
Verify: `node scripts/verify-phase-tt5c-staging.mjs`

### Client

- `teamRefereeV5BridgeEngine.js` — result mapping, outbox type normalization, resync helpers
- `teamTournamentRpcService.js` — `rpcTeamTournamentResyncRefereeLink`
- Repositories — `resyncRefereeLink`
- `TeamSubMatchRefereeProvisionRow.jsx` — minimal BTC card
- `TeamMatchupOperationsCard.jsx` + `TeamTournamentSetup.jsx` — provision/resync/revoke wiring

### Tests & evidence

- Unit: `tests/team-tournament-tt5c.test.js`
- Staging: `docs/v5/qa-evidence/phase-tt5/TT5C_*.json`

---

## Official result ownership

| Layer | Owns |
|-------|------|
| Referee V5 | Live scoring, event history, `match_result_revisions` |
| Team Tournament | Sub-match summary, matchup aggregate, standings cache |
| Consumer | One-way apply V5 revision → TT (no dual write) |

---

## Out of scope (TT-5C)

- Production deploy
- DreamBreaker
- Full correction UI
- Realtime TT-6 system-wide
- Offline
