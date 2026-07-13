# CC-08C — TT-4 Standings Regression (Latest Base)

Baseline after integration: `cb32ae2` + CC-08 commits on `feature/competition-core-cc08-standings`.

## Field audit — `teamStandingsEngine.js`

Legacy row fields (unchanged since CC-08 base):

| Field | Present | Canonical mapping |
|-------|---------|-------------------|
| `teamId` | yes | `entryId` / `teamId` |
| `rank` | yes | `rank` |
| `played` | yes | `played` |
| `wins` | yes | `wins` |
| `losses` | yes | `losses` |
| `subMatchWins` | yes | `gamesFor` → `subMatchWins` |
| `subMatchLosses` | yes | `gamesAgainst` → `subMatchLosses` |
| `subMatchDiff` | yes | `gameDifference` → `subMatchDiff` |
| `pointsScored` | yes | `scoreFor` → `pointsScored` |
| `pointsConceded` | yes | `scoreAgainst` → `pointsConceded` |
| `rankingPoints` | yes | `points` → `rankingPoints` |
| `forfeitWins` | **no** | N/A — TT-4 forfeit flows through `winnerTeamId` + sub-match stats |
| `forfeitLosses` | **no** | N/A |

## TT-4 forfeit / withdrawal behavior

- Forfeit sub-matches set `SUB_MATCH_STATUS.FORFEIT`; matchup completion sets `winnerTeamId`.
- `forfeitWorkflowEngine` builds RPC payloads (`team_withdrawal`, `no_show`, etc.) — standings impact is via completed matchup result, not separate forfeit counters.
- Technical score defaults (`winnerPoints`/`loserPoints`) affect sub-match points, aggregated into `teamAPoints`/`teamBPoints`.

## Regression results (latest base)

| Case | Legacy | Shadow parity | Test |
|------|--------|---------------|------|
| Normal completed matchup | PASS | PASS | CC08C-6, cc08 #32 |
| Forfeit winnerTeamId | wins/losses updated | PASS | CC08C-4, CC08C shadow forfeit group |
| Team withdrawal result | standings stable | PASS | CC08C-5 |
| Multi-team round robin | ranks deterministic | PASS | CC08C-6 |
| Tie-break order (wins → subMatchDiff → pointsScored → manual) | PASS | PASS | cc08 team bridge |
| Manual override on group rows | PASS | PASS | CC08C-11 |
| Qualification cutoff (group) | PASS | PASS | CC08C-12 |
| TT-4 test suite import | PASS | PASS | CC08C-18 |

## Fields introduced after `6596e53`

Standardization commits since base did **not** modify `teamStandingsEngine.js` or TT-4 standings row shape. No new mapper fields required.

## Risk

Low — team mapper covers all legacy row fields. Forfeit/withdrawal semantics remain outcome-based (wins/losses), not separate forfeit counters.
