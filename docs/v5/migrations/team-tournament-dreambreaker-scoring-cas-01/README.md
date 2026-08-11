# team-tournament-dreambreaker-scoring-cas-01

**Workstream:** `TEAM-TOURNAMENT-PR412-DREAMBREAKER-SCORING-CONFIG-CAS-01`

**Status:** LOCAL PACKAGE ONLY — do **not** apply without Owner GO.

## Problem

Live Staging `team_tournament_record_dreambreaker_point` uses hidden fallback `targetScore=11` when no Dreambreaker catalog row exists. Preview UI shows Rally 21 / winBy 2. Owner contract: default is 21/2, configurable per matchup, not a hard-coded-only 21.

Point +1 also skipped CAS when the client omitted `expectedVersion`. Concurrent / double-click could accept two rallies.

## Canonical config location

Reuse existing `scoringFormat` (`targetScore`, `winBy`, `rotationPoints`). `targetPoints` is an alias for `targetScore`.

Per-match override (no new column):

`team_tournament_matchups.schedule_meta.dreambreakerScoringFormat`

or

`schedule_meta.dreambreaker.scoringFormat`

Client also accepts `matchup.dreambreaker.scoringFormat`.

Resolution:

1. Matchup-specific override
2. Catalog Dreambreaker `scoring_format` (same matcher as start, including `tie_at_2_2`)
3. Fallback `targetScore=21`, `winBy=2`, `rotationPoints=4`

Current fixture `team-tournament-4zllu71z` / `matchup-ilj0220c` has no override and no catalog row → effective 21/2 from fallback. No fixture patch.

## Client pairing

`TeamRefereePortal.handleDreambreakerPoint` → `buildRefereeDreambreakerPointCommand` → `expectedVersion = matchup.dreambreaker.version`

UI hints: `getDreambreakerScoringHints` from the same resolver.

## Server contract (this package)

| Check | Behavior |
|-------|----------|
| Scoring resolve | schedule_meta override → catalog → default 21/2/4 |
| Missing expectedVersion | VALIDATION, zero write |
| CAS | `UPDATE ... WHERE version = p_expected_version` |
| Stale / concurrent same version | `version_conflict`, zero score/rally write |
| Accepted +1 | dreambreaker.version +1 once; matching submatch.version +1 once |
| Authority | `dreambreaker_states.version` only |

## Not in this package

- Stage Tie-break Policy (`DREAMBREAKER` vs `TOTAL_SUBMATCH_POINTS`)
- Freeze / side-switch server enforcement (still UI/docs only)
- Start / order / privacy RPCs
- Fixture reset or fixture-specific target patch

## Files

| File | Purpose |
|------|---------|
| `01_PRECHECK.sql` | Current default 11 + optional CAS; live fixture 0-0 v4 |
| `02_APPLY.sql` | Harden record-point RPC only |
| `03_VERIFY.sql` | Resolve + atomic CAS + grants; no fixture mutation |
| `04_ROLLBACK.sql` | Restore prior record-point body only |

## Locked SHA256

| File | SHA256 |
|------|--------|
| `01_PRECHECK.sql` | `8a1dd8e10dfa8e029aa27166731bf92767025c4e900972557f74b081c9ad95d5` |
| `02_APPLY.sql` | `21d90c75c9fb33bd3c8d09fd7708f13b09b919bd8460b8bae804af056eff7db7` |
| `03_VERIFY.sql` | `53a40025bd803e3064e9207b3f1473ec659501d7b9f352dbb4cb3d4a0f2eb44c` |
| `04_ROLLBACK.sql` | `9018aa8e6bc1b8b177f2706a9353187c6f3fee3cbc13d36227b9c0f544882965` |

Do not apply this package without Owner GO. Zero Staging/Production mutations in this workstream.
