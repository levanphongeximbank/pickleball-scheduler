# team-tournament-lineup-revision-cas-01

**Workstream:** `TEAM-TOURNAMENT-PR412-LINEUP-REVISION-CAS-REMEDIATION-01`

**Status:** LOCAL PACKAGE ONLY — do **not** apply without Owner GO.

## Problem

Captain Portal sent `expectedVersion = tournament.version` while lineup RPCs compare `lineup.version`. Combined with write-before-CAS order, Save Draft could persist selections then return `version_conflict`, showing a false “người khác cập nhật” warning.

## Contract

| Field | Meaning |
|-------|---------|
| `p_expected_version` | `team_tournament_lineups.version` only |
| First create | `expectedVersion = 0` → insert `version = 1` |
| Update | `expectedVersion = current` → bump once |

## CAS order (save + submit)

1. Resolve existing lineup  
2. Compare expected vs current (create: expect `0`)  
3. On mismatch → `version_conflict` with **zero writes**  
4. On match → write selections/status  
5. Bump `lineup.version` exactly once  
6. `finish_command` only on success  

## Files

| File | Purpose |
|------|---------|
| `01_PRECHECK.sql` | Capture write-before-CAS + grants |
| `02_APPLY.sql` | Remediat save_draft + submit CAS-before-write |
| `03_VERIFY.sql` | Prove CAS order + grants |
| `04_ROLLBACK.sql` | Restore pre-remediation bodies |

## Client pairing

`resolveLineupExpectedVersion(ownLineup)` → `ownLineup.version ?? 0`  
Must ship with this package; do not use `tournament.version` for lineup RPCs.
