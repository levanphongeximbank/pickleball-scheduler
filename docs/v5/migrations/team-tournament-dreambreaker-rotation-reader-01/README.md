# team-tournament-dreambreaker-rotation-reader-01

**Workstream:** `TEAM-TOURNAMENT-PR412-DREAMBREAKER-ROTATION-READER-01`

**Status:** LOCAL PACKAGE ONLY — do **not** apply without Owner GO.

## Problem

Staging `team_tournament_record_dreambreaker_point` correctly advances rotation every 4 total rallies. Live fixture `matchup-ilj0220c` is persisted `segmentIndex=1` / `pointsInSegment=0` after four Đội 1 rallies.

`team_tournament_get_setup` v7 `tournament.dreambreaker[matchupId]` omits `rotation`. After silent reload, `normalizeDreambreakerState` defaults `segmentIndex=0` and Preview still shows `Lượt 1: TT412-SEED-M04 vs TT412-SEED-M03`.

## Server contract (this package)

Add persisted `db.rotation` to the existing dreambreaker reader object:

```
rotation = coalesce(db.rotation, '{}'::jsonb)
```

That JSON already contains `segmentIndex`, `pointsInSegment`, `pointHistory`, `injurySkips`.

No recomputation. No point RPC change. No fixture patch.

## Client pairing

`attachPersistedDreambreakerProjection` → `matchup.dreambreaker.rotation` → `getDreambreakerCourtPlayers`.

Missing/legacy `{}` still normalizes to `segmentIndex=0`. No localStorage authority.

## Files

| File | Purpose |
|------|---------|
| `01_PRECHECK.sql` | Reader omits rotation; live fixture 4-0 v8 / segment 1 |
| `02_APPLY.sql` | Patch get_setup dreambreaker object only |
| `03_VERIFY.sql` | Reader exposes persisted rotation; point RPC unchanged |
| `04_ROLLBACK.sql` | Remove rotation key from reader object |

## Locked SHA256

| File | SHA256 |
|------|--------|
| `01_PRECHECK.sql` | `cda7a75b0096f33dc57988a39825da8e11ebed5347533ecd2da15dd3910843b3` |
| `02_APPLY.sql` | `e772a696e084a94cfecb9c8596502144e15c248fac466a3cfefa264c1915b008` |
| `03_VERIFY.sql` | `2586ad14e4a73268bf942a67dca7427fcdc61e7872da29d9413f5993f524c055` |
| `04_ROLLBACK.sql` | `571829f4734c5f22515bc2fc4b2ace57a1268c97471f4439439036d9e693f2d3` |

Do not apply this package without Owner GO. Zero Staging/Production mutations in this workstream.
