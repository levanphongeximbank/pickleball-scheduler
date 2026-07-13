# CC-08C — Conflict Resolution

## Summary

**Conflicts encountered: 0**

Rebase of `feature/competition-core-cc08-standings` onto `origin/feature/competition-core-standardization` (`cb32ae2`) completed cleanly.

## Files reviewed (potential overlap)

| File | Standardization delta since `6596e53` | CC-08 change | Resolution |
|------|--------------------------------------|--------------|------------|
| `competition-core/index.js` | none | standings exports added | N/A — no conflict |
| `adapters/legacyAdapter.js` | none | STANDINGS v2 routing | N/A |
| `package.json` | rating-v5 test scripts | cc08 test runner entry | auto-applied on rebase (CC-08 commit reapplied after cb32ae2) |
| `config/featureFlags.js` | none | STANDINGS_V2 flag (from CC-08 base) | N/A |
| `teamStandingsEngine.js` | none | unchanged | N/A |
| `rankingEngine.js` | none | unchanged | N/A |
| TT-4 standings files | none | unchanged | N/A |
| test runner | rating-v5 tests added by 824a639 | cc08 test file in CC-08 commit | rebased cleanly |

## Behavioral risk

None from integration — no manual conflict resolution required.

## Test coverage

- `tests/competition-core-standings-cc08.test.js` — 161 pass
- `tests/competition-core-standings-cc08c.test.js` — 142 pass (includes nested CC-06/07/TT-4/Draw imports)
