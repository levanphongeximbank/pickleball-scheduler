# CC-05C Court Parity

## Checks

- `courtId`, assigned players, pair keys
- Unassigned courts
- Session/venue metadata preservation flags

## API

- `extractLegacyCourtAllocation(result, payload)`
- `compareFormationCourtParity(input)`

Team-only MLP path maps teams as implicit court slots when explicit courts absent.

## Source

`formationCourtParity.js`
