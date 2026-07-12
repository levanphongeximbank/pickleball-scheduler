# CC-08 — Standings Domain Model

Contracts in `src/features/competition-core/standings/standingsContracts.js`.

| Type | Purpose |
|---|---|
| StandingsRequest | Normalized input envelope |
| StandingsConfiguration | Scoring + tie-break + qualification + drawLotSeed |
| StandingsEntry | Participant identity |
| StandingsMatchRecord | Normalized match result |
| StandingsRow | Computed statistics + rank |
| StandingsResult | Engine output |
| StandingsSnapshot | Pure reproducible snapshot (no DB) |
| StandingsDecisionTrace | Explainability / audit |
| ScoringRule | Versioned points policy |
| TieBreakRule / TieBreakStep | Ordered tie-break pipeline |
| ManualStandingsOverride | Preserved rank overrides |

StandingsRow supports entry/team/player IDs, played/wins/losses/draws, forfeits/walkovers/byes, points, game/set/score differences, seed, rank, qualificationStatus, warnings.
