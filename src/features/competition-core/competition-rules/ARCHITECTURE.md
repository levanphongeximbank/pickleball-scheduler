# Canonical Competition Rules & Format — Architecture

**Module:** `src/features/competition-core/competition-rules/`  
**Adapter A:** `competition.rules.policy.gateway.v1`  
**Status:** Domain + policy services + internal policy gateway complete.  
**Not:** Catalog Contract #17. **Not:** Mode Adapter B. **Not:** UI. **Not:** SQL.

## Position

```
PLATFORM CORE
  → COMPETITION PLATFORM
    → CORE-01 Competition Rule Engine (constraints — REUSED)
    → Canonical Competition Rules & Format (THIS MODULE — policy)
    → Adapter A / Policy Gateway (mode-agnostic)
    → Mode Adapter B (later — translation only)
    → Official / Internal / Team / Daily
```

## Authority boundaries

| Concern | Owner |
|---------|-------|
| Constraint resolution / precedence | CORE-01 |
| Scoring policy | competition-core.competition-rules |
| Scoring execution | CORE-16 |
| Referee requirement policy | competition-core.competition-rules |
| Referee assignment | CORE-13 |
| Match lifecycle mutation gate (policy) | competition-core.competition-rules |
| Match lifecycle execution | CORE-15 |
| Result policy | competition-core.competition-rules |
| Result acceptance | CORE-17 |
| Schedule constraint policy | competition-core.competition-rules |
| Schedule execution | schedule-engine / CORE-11 |
| Court requirement policy | competition-core.competition-rules |
| Court assignment execution | CORE-12 |
| Physical court identity SSOT (`physicalCourtId`) | 2.2_COURT_OPERATIONS |
| Adapter A court role | integration/projection — not physical court SSOT |
| Tie-break / cross-group ranking policy | competition-core.competition-rules |
| In-group standings / tie-break execution | CORE-18 |
| Cross-group wildcard ranking execution | DEFERRED (CORE-18 composition) |
| Knockout admission (bypass / direct entry) policy | THIS MODULE |
| Knockout admission execution (direct entry composition) | DEFERRED |
| Group-stage bypass execution (allocation consume plan) | PARTIAL |
| Knockout BYE execution | CORE-08 / CORE-09 / CE |
| Competition Rules Profile (policy) | THIS MODULE |

Tenant ≠ Venue. Venue / Facility / Court Cluster ≠ Physical Court.

## Persistence

- No new table in this workstream.
- Prefer deriving effective rules; profile persistence later via tournament/event settings or CM-04.
- `SQL_EXECUTION=NO`

## Fail-closed

- Invalid qualification → reject
- Unknown stage / rule class → reject
- Mode-specific keys on Adapter A → reject
- Execution-deferred *configured* capabilities → honest capability truth / profile `feasible=false` when demand exists
- Default schema policy objects alone do **not** configure deferred optional capabilities (e.g. cross-group wildcard ranking)
- Authoritative cross-group ranking request while deferred → fail-closed
- No fake operational support
