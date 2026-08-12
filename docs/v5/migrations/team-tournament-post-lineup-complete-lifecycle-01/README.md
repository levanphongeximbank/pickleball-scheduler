# team-tournament-post-lineup-complete-lifecycle-01

**LOCAL PACKAGE ONLY. Do NOT apply to Staging/Production without Owner GO.**

## Scope

Post-lineup complete lifecycle closure for PR #418:

1. `team_tournament_close_tournament` — dual-write `status=completed` on `team_tournaments` + `canonical_tournaments`; reuses existing closing settings keys only.
2. `team_tournament_update_setup_config` — whitelist `qualifiersPerGroup` (+ legacy `qualificationCount` sync) and `stageScoringPolicy`; fail-closed when `groupCount≥2` and `groupCount×qualifiersPerGroup ∉ {2,4,8,16}`.

## Architecture locks (Owner corrections)

- Coarse `matchup.stage` remains `group|knockout` (#416). No second stage taxonomy.
- Knockout round identity resolved via existing `resolveMatchupCompetitionStage` / SQL hop resolver.
- Close authority is lifecycle `status=completed` (server dual-write). No client dual-write.
- No inventing new settings keys beyond existing closing domain keys.
- Referee create uses `team_tournament_can_manage` + `referee_assignments`; `profiles` is identity/display only (`REFEREE_NOT_FOUND`), not role authority.

## Apply order

1. PRECHECK
2. APPLY once
3. VERIFY

## Locked SHA256 (LF)

| File | SHA256 |
|------|--------|
| `01_PRECHECK.sql` | `29556e2eb385ef977097d8285f237fd610ffe18492337a907d13d9fa418ac2ea` |
| `02_APPLY.sql` | `5de1731db27e0bdd067699099d45c6561cca1542d891271cf125209a75ef9308` |
| `03_VERIFY.sql` | `116a500abb4ab3a2c77d36fafcf2e552d23f1191c37ec5e1503840069a4b0d32` |
| `04_ROLLBACK.sql` | `fa7d7fa1f66167b03df0e4ef1368b468e3a41fa671c95e124a13bb3d5441c7be` |

## Safety

- STAGING apply only after Owner GO
- PRODUCTION_MUTATIONS=0
