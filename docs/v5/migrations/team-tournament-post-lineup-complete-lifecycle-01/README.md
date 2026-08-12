# team-tournament-post-lineup-complete-lifecycle-01

**LOCAL PACKAGE ONLY. Do NOT apply to Staging/Production without Owner GO.**

## Scope

Post-lineup complete lifecycle closure for PR #418 (B01–B04 hardened):

1. `team_tournament_assert_close_readiness` — server fail-closed from canonical matchups/results.
2. `team_tournament_close_tournament` — readiness gate → dual-write `status=completed`; **never** trusts client `summary` / `awardsSheet` / `frozenStandings` as result authority.
3. `team_tournament_update_setup_config` — whitelist `qualifiersPerGroup` + hardened `stageScoringPolicy` field/range validation; PoT fail-closed for multi-group totals.
4. `team_tournament_search_referee_candidates` — organizer searchable people directory (profiles identity; **no** `profiles.role` filter). Assign eligibility remains `create_referee_assignment` (profile exists).

## Architecture locks (Owner corrections)

- Coarse `matchup.stage` remains `group|knockout` (#416). No second stage taxonomy.
- Knockout round identity via `team_tournament_resolve_competition_stage` / client `resolveMatchupCompetitionStage`.
- Close authority is lifecycle `status=completed` after readiness; champion derived from completed results.
- `closingSnapshot` (if present) is presentation/audit only (`authoritative=false`).
- CLIENT_RESULT_PAYLOAD_TRUSTED_AS_AUTHORITY=NO
- MANUAL_REFEREE_UUID_REQUIRED=NO

## Apply order

1. PRECHECK
2. APPLY once
3. VERIFY (includes disposable readiness matrix; cleans up)

## Locked SHA256 (LF)

| File | SHA256 |
|------|--------|
| `01_PRECHECK.sql` | `a3b8fa006681e0c3cdc66cb6b6ade80b536885f134c3be76d2c5bf7615232134` |
| `02_APPLY.sql` | `dfbaa6e318cc7c9e86bc6255661fa14eb535030827f7cc0245cf78095357f394` |
| `03_VERIFY.sql` | `bd5abbc8848dd8e852fc8bd679fcd206285acee3ca40d8b6e7092cdd55808747` |
| `04_ROLLBACK.sql` | `e4c714c1e6e2781586ffabe4a45a071d437acde43d05d3bd82594b0b80e91f03` |

## Safety

- STAGING apply only after Owner GO
- PRODUCTION_MUTATIONS=0
