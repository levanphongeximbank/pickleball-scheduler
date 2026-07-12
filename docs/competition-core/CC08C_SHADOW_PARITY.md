# CC-08C — Shadow Parity (Latest Base)

Run context: integrated branch `7ac732a` on `cb32ae2` standardization base.  
Mode: `runStandingsShadowComparison` / `evaluateCanonicalStandingsRuntime` with `executionMode: shadow`.

## Scenario results

| # | Scenario | membershipParity | rankParity | pointsParity | statisticsParity | forfeitParity | qualificationParity | tieBreakParity | warnings | unsupportedFields |
|---|----------|------------------|------------|--------------|------------------|---------------|---------------------|----------------|----------|-------------------|
| 1 | Individual group standings | PASS | PASS | PASS | PASS | n/a | n/a | PASS | none | none |
| 2 | TE 4.0 base standing (shared builder) | PASS | PASS | PASS | PASS | n/a | deferred | PASS | TE full sort layer legacy-only | qualification overlay |
| 3 | Team tournament standings | PASS | PASS | PASS | PASS | via wins/losses | n/a | PASS | none | none |
| 4 | Forfeit group match | PASS | PASS | PASS | PASS | PASS | n/a | PASS | none | none |
| 5 | Withdrawal team matchup | PASS | PASS | PASS | PASS | PASS | n/a | PASS | none | none |
| 6 | Multi-way tie (3 entries) | PASS | PASS | PASS | PASS | n/a | n/a | PASS | mini-table trace | none |
| 7 | Manual override (rank) | PASS | PASS | PASS | PASS | n/a | n/a | PASS | none | none |
| 8 | Qualification cutoff (group complete) | PASS | PASS | PASS | PASS | n/a | PASS | PASS | none | none |

## Notes

- **forfeitParity:** No separate `forfeitWins`/`forfeitLosses` columns in legacy team rows; parity validated via wins/losses and rankingPoints after forfeit/withdrawal outcomes.
- **TE 4.0 full output:** `computeRankings` qualification strings and wins-first re-sort remain legacy-only (see coverage matrix). Shadow parity validated on shared `buildGroupStandingFromMatches` base only.
- **Session/season:** Not in shadow scope — intentionally bypassed.

## Test references

- `tests/competition-core-standings-cc08.test.js` — scenarios 29, 31–32, 629–654
- `tests/competition-core-standings-cc08c.test.js` — CC08C-5 through CC08C-8, forfeit shadow, team field mapping

## Verdict

Shadow parity **PASS** for all wired paths on latest base. No rank/points drift detected in shadow mode.
