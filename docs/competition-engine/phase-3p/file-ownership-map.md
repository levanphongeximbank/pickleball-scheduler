# File Ownership Map — Phase 3P

## Capability-owned directories (target layout)

Capability chats create **new** trees under competition-core when missing. Existing co-located contracts stay until Integrator migrates (do not speculative-refactor in 3B–3E).

| Phase | Capability | Primary ownership (new work) | Existing contracts (read/extend with rules) |
|-------|------------|------------------------------|--------------------------------------------|
| 3B | Participant | `participants/runtime/**` (new), identity/participant validators | `contracts/identity.js`, `competitionParticipant.js`, `shared.js` |
| 3C | Registration | `participants/runtime/registration/**` or `registration/**` (new) | `contracts/entryRegistration.js` only |
| 3D | Team | `team-tournament/**` (format) + `participants/ports` team section | `teamRosterLineup.js` team/roster sections |
| 3E | Lineup | `team-tournament/engines/lineup*` + lineup validators | lineup sections of `teamRosterLineup.js` |
| 3F | Seeding | `seed/**` | — |
| 3G | Draw | `draw/**` | — |
| 3H | Match | `matchmaking/**`, `formation/**` | — |
| 3I | Schedule | `scheduling/**` | — |
| 3J | Lifecycle | `lifecycle/**` (**new**) | `lifecycleMarkers.js` (enums only) |
| 3K | Standings | `standings/**` | — |
| 3L | Publication | `publication/**` (**new**) | — |

## Contract file partition (participants) — mandatory for parallel 3B/3C/3D/3E

| File | Owner phase | Other phases |
|------|-------------|--------------|
| `contracts/shared.js` | **Integrator / freeze** after 3B | Read-only |
| `contracts/identity.js` | **3B** | Read-only |
| `contracts/competitionParticipant.js` | **3B** | Read-only |
| `contracts/entryRegistration.js` | **3C** | Read-only after freeze |
| `contracts/teamRosterLineup.js` | **3D** (team/roster) then **3E** (lineup) — sequential sections | No simultaneous edits |
| `contracts/divisionCategory.js` | Integrator / 3B if needed | Read-only |
| `contracts/index.js` | **Integrator** | Capability PRs must not edit |
| `participants/index.js` | **Integrator** | Capability-local re-exports preferred |
| `validators/index.js` | **Integrator** | Add `validators/<capability>.js` files instead |
| `mappings/index.js` | **Integrator** | Add mapping modules; Integrator re-exports |
| `ports/index.js` | **Integrator** | Add port modules; Integrator re-exports |
| `dto/index.js` | **Integrator** | Same pattern |

## Format / legacy ownership (do not “claim” for rewrite)

| Tree | Owner | Notes |
|------|-------|-------|
| `src/features/team-tournament/**` | Format (3D/3E chats) | KEEP IN FORMAT — ports/shadow only from core |
| `src/features/individual-tournament/**` | Format (3C heavy) | Registration engines |
| `src/features/daily-play/**` | Format (3H adjacent) | Do not rewrite AI path early |
| `src/tournament/engines/**` | Legacy | Adapter wrapping only; no cutover |
| `src/domain/tournamentLifecycle.js` | Legacy (3J later) | Critical side effects — Integrator + Owner |

## Test ownership

| Pattern | Owner |
|---------|-------|
| `tests/competition-core-participants-3b*.test.js` | 3B |
| `tests/competition-core-registration-3c*.test.js` | 3C |
| `tests/competition-core-*-3<letter>*.test.js` | Matching phase |
| Existing 2b2/2b3/2b4 tests | Read-only unless bugfix approved |
| Format tests `tests/team-tournament*` | 3D/3E only |

## Explicit non-ownership

Capability chats **do not own**:

- Root `competition-core/index.js`
- `runtime-control/**` (except adding comparator modules under Integrator-approved path)
- `scripts/ci/**`
- `package.json`
- Architecture lock baseline (unless debt removal approved)
- Production UI pages (wiring only in later Owner-approved phases)
