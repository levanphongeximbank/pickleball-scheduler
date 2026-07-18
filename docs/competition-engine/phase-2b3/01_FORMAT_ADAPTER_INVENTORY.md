# 01 — Format Adapter Inventory

| Format | Adapter path | Wired to runtime? | Notes |
|--------|--------------|-------------------|-------|
| Team Tournament V6 | `src/features/team-tournament/adapters/competition-core/` | **No** | Player, Team, Roster, Lineup, Registration |
| Individual Tournament | `src/features/individual-tournament/adapters/competition-core/` | **No** | Player, Entry/Registration, Classification |
| Daily Play | `src/features/daily-play/adapters/competition-core/` (+ re-export under `src/tournament/adapters/competition-core/daily/`) | **No** | Participant + session + temporary pair |
| Internal Tournament | `src/tournament/adapters/competition-core/internal-official/` | **No** | Evidence via Individual mapping + format extension |
| Official Tournament | same as Internal | **No** | Open registration + seed-locked snapshot |

## Shared utilities

```text
src/tournament/adapters/competition-core/shared/
  diagnostics.js
  mappingResult.js
  parity.js
  shadowRunner.js
  personReference.js
```

## Dependency direction

```text
Format adapter → competition-core/index.js (public API)
competition-core → format adapters   FORBIDDEN
```

## Core public API

Adapters import only:

```text
src/features/competition-core/index.js
```

No deep imports into `participants/`.
