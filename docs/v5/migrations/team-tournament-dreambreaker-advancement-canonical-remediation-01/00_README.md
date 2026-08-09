# Team Tournament — Dreambreaker + Advancement Canonical Remediation 01

**DO NOT APPLY to Staging or Production without explicit Owner GO.**

## Scope

Local code + migration package preparation only.

| Gap | Staging | Production |
|-----|---------|------------|
| `team_tournament_dreambreaker_states` table | present | present |
| `recompute_matchup_result` | present | **missing** |
| versioned `confirm_sub_match` | present (no DB activation) | **legacy 5-arg only** (false-completes 2–2) |
| Dreambreaker command RPCs | **missing** | **missing** |
| `apply_forfeit` / `withdraw_team` | present | **missing** |
| `randomize_lineup` | present | **missing** |

## Apply order (when authorized)

1. `10_RECOMPUTE_AND_DREAMBREAKER_ACTIVATE.sql`
2. `20_DREAMBREAKER_COMMAND_RPCS.sql`
3. `30_FORFEIT_WITHDRAW_PARITY.sql` (Production parity; idempotent on Staging; **does not** redefine `recompute_matchup_result` — file 10 owns Dreambreaker-aware body)
4. `40_RANDOMIZE_LINEUP_PARITY.sql` (Production parity; active UI requires it)
5. `50_VERIFY.sql` (select-only + hard-fail if final recompute body lacks `needsDreambreaker`)

Rollback: `90_ROLLBACK.sql` drops **new** Dreambreaker command RPCs only.

## Safety

- Fail-closed auth/tenant on all writers
- No destructive cleanup
- No broad historical replay
- Route contract unchanged: `team_tournaments.tournament_id`
