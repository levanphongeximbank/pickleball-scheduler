# E2E-02 — Ownership and Reuse Map

## File ownership (E2E-02)

| Path | Owner | Role |
|------|-------|------|
| `src/features/competition-engine/templates/` | E2E-02 | Canonical IND Pool+KO template definition |
| `src/features/competition-engine/formats/` | E2E-02 | Pool+KO format definition + validation |
| `src/features/competition-engine/composition/` | E2E-02 | Pool/Qualification/Knockout orchestrators + CORE adapters |
| `src/features/competition-engine/application/` | E2E-02 | CM wiring facade + runtime composition |
| `docs/competition-engine/e2e-02/` | E2E-02 | Workstream docs |
| `tests/competition-engine-e2e-02-individual-pool-knockout.test.js` | E2E-02 | Targeted tests |

## Canonical reuse (no forks)

| Capability | Import path | Used for |
|------------|-------------|----------|
| CM-02 Template | `competition-management/template-instantiation` | validate/register/instantiate |
| CM-01 Definition | `competition-management/competition-definition` | draft definition for instantiation |
| CORE-08 Draw | `competition-core/draw-runtime` | snake grouping, bracket slots, byes |
| CORE-09 Match Gen | `competition-core/match-generation` | GROUP_RR + SINGLE_ELIM |
| CORE-18 Standings | `competition-core/standings` | pool tables when results provided |
| E2E-01 Ports | `competition-engine/integration` | identity/tenant/venue runtime bag |

## Explicitly not created

- Parallel match / bracket / standings / participant engines
- UI / portals
- CM `staticCatalog.js` rewrite (registration via public API)
- Root `competition-core/index.js` re-export changes (capability-local imports only)
