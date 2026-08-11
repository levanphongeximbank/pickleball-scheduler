# team-tournament-dreambreaker-final-closure-01

**Workstream:** `TEAM-TOURNAMENT-PR412-DREAMBREAKER-FINAL-CLOSURE-01`

**Status:** LOCAL PACKAGE ONLY — do **not** apply without Owner GO.

## One Staging apply

This package is the single remaining SQL delta after PR #412 Dreambreaker packages:

| Package | Staging |
|---------|---------|
| `team-tournament-dreambreaker-referee-start-canonical-01` | applied `20260811073528` |
| `team-tournament-dreambreaker-lineup-filter-01` | applied `20260811084416` |
| `team-tournament-dreambreaker-scoring-cas-01` | applied `20260811105925` |
| `team-tournament-dreambreaker-rotation-reader-01` | **not applied** — superseded here |
| this package | **not applied** |

Do not replay scoring-cas. Do not apply rotation-reader separately.

## Delta

1. `team_tournament_get_setup` exposes persisted `rotation`, resolved `scoringFormat`, and `subMatchId`.
2. `team_tournament_undo_dreambreaker_point` requires `dreambreaker.version` CAS, wraps rotation every 4, and recomputes parent matchup + standings (no half-reopen).
3. `team_tournament_record_dreambreaker_point` calls `team_tournament_recompute_standings_cache` on completion.

Point scoring/CAS/default 21 are unchanged.

## Live fixture

`team-tournament-4zllu71z` / `matchup-ilj0220c` remains `4-0` / version `8` / `segmentIndex=1`. No fixture patch.

## Locked SHA256

| File | SHA256 |
|------|--------|
| `01_PRECHECK.sql` | `c1539d98a4abfe4fc3d95d082542810d57e8a84d9e6308aea5ea0cd3c554863f` |
| `02_APPLY.sql` | `95744c0350b0c3ef6ad2913a37cf6a3d15701263d3c9fff92d098f2ab9ed12e3` |
| `03_VERIFY.sql` | `2d0462896caf50eb27555c7cc600dfa93ba46c0794d8380cc94596c0054c85e8` |
| `04_ROLLBACK.sql` | `c16f30ae09c328c153fd9ac9a6845b246cfd861e1b2b4599bbc77cb21a390d0e` |
