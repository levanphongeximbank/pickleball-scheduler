# TT-5D Reopen Policy

## BTC reopen

`team_tournament_reopen_referee_match` creates **void** revision (revision N+1), unlocks `match_live_states`, emits outbox, consumes via TT-5C.

## Effects on Team Tournament

- Sub-match → `waiting` (per TT-5C mapper)
- Bridge → `active`
- Standings recomputed (not incremental client upsert)
- Legacy score path remains locked when bridge linked

## Re-finalize

New finalize revision + new outbox event; consumer applies exactly-once via inbox dedupe.
