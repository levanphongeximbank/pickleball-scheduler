# team-tournament-canonical-referee-lifecycle-01

**LOCAL PACKAGE ONLY. Do NOT apply to Staging/Production without Owner GO.**

**Forward-only.** NEVER re-run prior packages.

## Why

Organizer assigned referees per sub-match and had to click **Tạo phiên trọng tài**.
Portal click was navigation-only. Dreambreaker did not inherit parent referee.
`start_dreambreaker` authorized via broad `can_manage_results()` **before**
`begin_command`, so assigned referees without `tournament.update` /
`team.match.result.manage` received `FORBIDDEN` with no command_log row.
`NOT_ACTIVATED` was unmapped. Replay start reset scores.

## Canonical model

Reuse `referee_assignments`. Parent matchup assignment:

- `match_id` = `external_matchup_id`
- `sub_match_id` IS NULL

Effective referee (server):

1. explicit live child override (`match_id` = sub external id)
2. else live parent assignment
3. else unassigned

When child is actionable **and** effective referee exists, server ensures
Referee V5 `match_live_states` + `team_sub_match_referee_links` idempotently
(unique_violation → success). Hooks: parent assign, matchup publish trigger,
sub-match insert (Dreambreaker child), confirm, start.

Write authority:

- organizer/admin: `team_tournament_can_manage()`
- assigned referee: effective assignment for that matchup/child
- broad result-management permission is **not** enough for unassigned Match B

## Dreambreaker start

- scoped write guard (not `can_manage_results`)
- missing state → `NOT_ACTIVATED` with operator message
- already `in_progress`/`completed` → `ALREADY_STARTED` structured success (no score reset)
- ready + stale version → `VERSION_CONFLICT`
- first valid start creates `db-{matchupId}` once and auto-ensures V5 runtime

## Apply order (Owner GO only)

1. `01_PRECHECK.sql`
2. `02_APPLY.sql` **once**
3. `03_VERIFY.sql`
4. `04_ROLLBACK.sql` emergency helpers-only

## Owner fixture

`89d8ffed-70f1-4bd1-9294-abdf0016bbad` — read-only. `OWNER_FIXTURE_MUTATIONS=0`.

## Package LF SHA256 lock

| File | SHA256 |
|------|--------|
| `01_PRECHECK.sql` | `ce9392188218e9a0ee5c45aa0b64ae3955079c2b4c33622b0109a238b71b8956` |
| `02_APPLY.sql` | `eb0fab536f400178339260c259c9ec5ae40e8394ee14913f50bedadda39d7bdb` |
| `03_VERIFY.sql` | `29e21fc20dc0db0af1607129efd259f7920e4f1e3d07348801f48ab0b03a8859` |
| `04_ROLLBACK.sql` | `cbe029e5f4c159fd4e414adcceb45b73781390199c8a76bc3fbc4160947e733d` |
