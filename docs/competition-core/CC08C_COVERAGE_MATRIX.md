# CC-08C — Standings Coverage Matrix

Flag: `VITE_COMPETITION_CORE_STANDINGS_V2_ENABLED` (requires `VITE_COMPETITION_CORE_ENABLED=true`)

Default runtime mode when flag ON: **shadow** (legacy primary, canonical compare).

| Runtime path | Consumer | Canonical adapter | Flag behavior | Shadow parity | Business output owner | Deferred reason | Future phase |
|--------------|----------|-------------------|---------------|---------------|----------------------|-----------------|--------------|
| Legacy group standings | `rankingEngine.buildGroupStandingFromMatches` | **WIRED** (group mapper) | OFF→legacy; ON→shadow | PASS on latest base | Legacy | — | CC-09 primary cutover (owner GO) |
| Tournament Engine 4.0 base standing | TE `computeRankings` inner builder | **SHADOW_ONLY** (group mapper on shared builder) | ON→shadow on mapped payload | PASS (base rows) | Legacy TE sort/qualification layer | TE re-sort uses wins-first criteria + qualification overlay | CC-09 TE orchestrator bridge |
| TE 4.0 full ranking output | `computeRankings` | **LEGACY_ONLY** (not fully mapped) | Legacy only for qualification/tie notes | Partial — full TE output not canonical-primary | Legacy TE | Different tie-break order vs group mapper | CC-09 |
| Team tournament standings | `teamStandingsEngine.computeTeamStandings` | **WIRED** (team mapper) | OFF→legacy; ON→shadow | PASS | Legacy | — | CC-09 |
| Season standings | `seasonStandingsEngine` | **LEGACY_ONLY** | Never intercepted | N/A | Legacy season service | Different points model + league aggregation | CC-10+ season engine |
| Session standings | `tournament.standings.logic` | **LEGACY_ONLY** | Never intercepted | N/A | Legacy session UI | 3/1/0 points, team-key rows, no forfeit/BYE | CC-10+ session adapter |
| League standings | `seasonStandingsService` / club blob | **LEGACY_ONLY** | Never intercepted | N/A | Legacy | Multi-tournament aggregation | CC-10+ |
| UI-only sorting | table components | **OUT_OF_SCOPE** | N/A | N/A | UI | Display-only | — |
| Cached standings | cloud blob / localStorage | **OUT_OF_SCOPE** | N/A | N/A | Persistence layer | Not a calculation path | — |
| Qualification calculations | TE ranking + canonical engine | **SHADOW_ONLY** | Canonical computes qualification on mapped group requests | PASS for mapped group cutoff | Legacy for TE overlay | TE qualification status strings differ | CC-09 |

## Classification legend

- **WIRED** — explicit mapper + runtime adapter path
- **SHADOW_ONLY** — canonical runs in shadow; legacy remains authoritative
- **LEGACY_ONLY** — no adapter hook; STANDINGS_V2 does not replace
- **OUT_OF_SCOPE** — not a standings engine responsibility
- **BLOCKED** — none

## Important constraint

STANDINGS_V2 does **not** claim coverage of season/session/league paths. Inventory (`LEGACY_STANDINGS_RUNTIME_INVENTORY`) documents these as legacy-only with no canonical edge.
