# team-tournament-dreambreaker-lineup-filter-01

**Workstream:** `TEAM-TOURNAMENT-PR412-DREAMBREAKER-FIFTH-DISCIPLINE-LINEUP-REGRESSION-REMEDIATION-01`

**Status:** LOCAL PACKAGE ONLY — do **not** apply without Owner GO.

## Problem

Canonical Dreambreaker catalog row (`id=dreambreaker`, `disciplineKind=dreambreaker`, `activationRule=tie_at_2_2`) is activation-only. It must remain in the full catalog but must **not** be treated as an initial pre-match lineup slot.

Current captain UI mapped all `teamData.disciplines`, and `team_tournament_validate_lineup_selections` looped every catalog row. Result:

- UI: `Dreambreaker / VĐV 1`
- Submit: `Dreambreaker cần 1 VĐV.`

## Client pairing

Ordinary pre-match lineup render / validation uses `getActiveMatchDisciplines()` via `isActivationOnlyDreambreakerDiscipline`:

- skip `disciplineKind='dreambreaker'`
- skip `activationRule='tie_at_2_2'`

Full catalog `teamData.disciplines` is unchanged (5 MLP rows remain). Setup catalog editor (`TeamDisciplinesPanel`) still shows the 5th row.

## Server contract (this package)

| Check | Behavior |
|-------|----------|
| Function | `public.team_tournament_validate_lineup_selections` only |
| Skip | `discipline_kind='dreambreaker'` OR `activation_rule='tie_at_2_2'` |
| Ordinary slots | `playerCount` / gender / MLP participation still enforced |
| RLS / RBAC | unchanged |
| Grants | CREATE OR REPLACE preserves EXECUTE |
| Catalog / trigger / start | not touched |

Required:

- `DREAMBREAKER_SKIPPED_FROM_LINEUP_VALIDATION=YES`
- `NORMAL_DISCIPLINES_STILL_VALIDATED=YES`
- `RLS_CHANGED=NO`
- `RBAC_CHANGED=NO`
- `GRANTS_PRESERVED=YES`

## Files

| File | Purpose |
|------|---------|
| `01_PRECHECK.sql` | Prove current validator loops all catalog rows and includes Dreambreaker |
| `02_APPLY.sql` | Skip activation-only Dreambreaker in both validation loops |
| `03_VERIFY.sql` | Skip markers + ordinary rules + grants; no fixture mutation |
| `04_ROLLBACK.sql` | Restore prior live validator body |

## Locked SHA256

| File | SHA256 |
|------|--------|
| `01_PRECHECK.sql` | `0a015b8fd0470e67007d5a92508670ee87fb111e1b777a16000726febd234b25` |
| `02_APPLY.sql` | `81aac4c8077da4e174fed7c5313fd801b601cfc4feaa615697526984e5e2dc8c` |
| `03_VERIFY.sql` | `c50dd435fc3b1dabe6a6419f3141b8c345f1cd4945b71bd72e7132595cd01bdd` |
| `04_ROLLBACK.sql` | `518f318f8b686a25a6d27b70b16529827abbc9b0842b5ec9bdb41a7f1632d3b7` |

Do not apply this package without Owner GO. Zero Staging/Production mutations in this workstream.

## Next phase — stage-level tie-break policy (DO NOT IMPLEMENT HERE)

`STAGE_TIEBREAK_POLICY_IMPLEMENTED=NO`

Default ordinary contents (organizer may add / remove / reorder later):

1. Đôi nam
2. Đôi nữ
3. Đôi nam nữ 1
4. Đôi nam nữ 2

Dreambreaker is a **separate tie-break policy**, not a pre-match lineup discipline.

Future stage-level policy (may differ per stage: group, R16, QF, SF, final):

- **A. DREAMBREAKER** — current 2-2 activation + 4-athlete order + referee start
- **B. TOTAL_SUBMATCH_POINTS** — when submatch wins are tied, sum all submatch points and decide the winner by total points

Do not implement TOTAL_SUBMATCH_POINTS or organizer content CRUD in this remediation.
