# CC-08 — Runtime Adapter

Entry: `evaluateCanonicalStandingsRuntime()` in `standings/adapters/standingsRuntimeAdapter.js`.

Flow:
1. Clone legacy payload
2. Flag OFF → direct legacy executor
3. Flag ON → memoized legacy executor (single invocation)
4. Map payload → StandingsRequest
5. `calculateCanonicalStandings()`
6. Build shadow comparison
7. Return legacy primary output (shadow mode) + canonical result + trace

Also wired in `executeCompetitionEngine()` for `COMPETITION_ENGINE_TYPE.STANDINGS`.

Execution modes: `shadow` (default), `legacy-primary`, `canonical-primary` (tests/staging only).

No database writes.
