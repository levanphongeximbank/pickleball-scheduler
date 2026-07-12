# CC-05C Performance Report

Measured via `measureFormationPerformanceBaseline()` on fixture matrix.

## Fixtures

| Label | Players |
|-------|---------|
| 4_players_even | 4 |
| 8_players | 8 |
| 12_players | 12 |
| 20_players | 20 |

## Metrics

- `legacyDurationMs` — direct `pairTeamsFromSelectedPlayers`
- `shadowDurationMs` — full shadow comparison (includes adapter overhead)
- `adapterDurationMs` — approximated shadow minus legacy
- `candidateCount` — teams formed

## Note

Heap measurement not available in CC-05C baseline. No algorithm optimization performed — reporting only.

## Verdict

Adapter/shadow overhead acceptable for MLP wizard path; no production flag enabled.
