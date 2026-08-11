# team-tournament-submatch-score-revision-cas-01

**Workstream:** `TEAM-TOURNAMENT-PR412-SUBMATCH-SCORE-REVISION-CAS-REMEDIATION-01`

**Status:** LOCAL PACKAGE ONLY — do **not** apply without Owner GO.

## Problem

Team Referee Portal passed `expectedVersion = tournament.version` while confirm CAS compares `team_tournament_sub_matches.version`. Live example: tournament.version=11 vs subMatch.version=1 → false `version_conflict` with zero write.

Save draft was a versionless 4-arg RPC (no CAS, no version bump, no idempotency).

## Contract

| Field | Meaning |
|-------|---------|
| `p_expected_version` | `team_tournament_sub_matches.version` only |
| Dirty edit base | Freeze subMatch.version at first local edit |
| Success | bump `version` exactly once |
| Stale | `version_conflict` + zero write |

## CAS order (save + confirm)

1. Resolve authorized submatch  
2. `begin_command`  
3. Compare expected vs `sub_matches.version` (**before** write)  
4. On mismatch → `version_conflict`, **zero write**, no finish  
5. On match → write score/result + bump version once  
6. `finish_command` only on success  

## Overload design

| RPC | Before | After |
|-----|--------|-------|
| `save_sub_match_draft` | 1× 4-arg (unsafe) | 1× 6-arg versioned only |
| `confirm_sub_match` | 5-arg wrapper + 7-arg CAS | 1× 7-arg (requires expectedVersion) |

## Files

| File | Purpose |
|------|---------|
| `01_PRECHECK.sql` | Inventory overloads + grants |
| `02_APPLY.sql` | Versioned save + require confirm CAS + drop bypass paths |
| `03_VERIFY.sql` | Prove CAS order + single overload + grants |
| `04_ROLLBACK.sql` | Restore pre-remediation bodies |

## Locked SHA256

| File | SHA256 |
|------|--------|
| `01_PRECHECK.sql` | `cb7bd9068ab43988c608d181922e45ec45b593f915e7639e6c406308cd3ba757` |
| `02_APPLY.sql` | `fdff434da7fb36d1d91fed3be4adcaffb8468307d2e25d1691ae961f44f865ff` |
| `03_VERIFY.sql` | `f66c17229cda3d9b4f59f88d3398d87918bd3b9b3987e9ab1985a2546122fe4c` |
| `04_ROLLBACK.sql` | `7113330d3e8cb53851096cb3d1cbb5837f384d1663323f5c11dee81b46adf270` |

## Client pairing

`resolveSubMatchRevision(subMatch)` / dirty `baseSubMatchVersion`  
Must ship with this package; do not use `tournament.version` for score RPCs.
