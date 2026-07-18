# Parallelization Matrix — Phase 3P

For each pair: **YES** / **NO** / **CONDITIONAL**, with reason, shared files, contracts, merge-order, risk, isolation.

---

## Required pairs

### 3B Participant vs 3C Registration — NO (Owner-locked)

| Field | Value |
|-------|-------|
| Can parallel | **NO — NOT ALLOWED initially** (Owner-locked 2026-07-18) |
| Reason | Both live under `participants/`; Registration **HARD** depends on Participant refs. Owner forbids initial parallel start. |
| Shared files | `participants/index.js`, `validators/index.js`, `mappings/index.js`, `ports/index.js`, `contracts/index.js`, root `competition-core/index.js` |
| Shared contracts | `identity.js`, `shared.js`, statuses enums |
| Merge-order | **3B must merge before 3C** |
| Risk | **HIGH** |
| Isolation | Sequential waves; Integrator owns barrels; file partition remains for later phases if Owner re-opens |

### 3B Participant vs 3D Team — CONDITIONAL

| Field | Value |
|-------|-------|
| Can parallel | **CONDITIONAL → YES with isolation** |
| Reason | Team runtime is **FORMAT_LOCAL** (KEEP IN FORMAT). Needs Participant refs as **CONTRACT_ONLY**. Can work in `team-tournament/**` + ports while 3B builds participant runtime — if 3D does not mutate participant identity contracts. |
| Shared files | `teamRosterLineup.js` (contracts), participants ports/mappings, root index |
| Shared contracts | `ParticipantReference`, team/roster factories |
| Merge-order | Prefer freeze Participant identity before merging Team ports that import new APIs |
| Risk | **MEDIUM** |
| Isolation | 3D forbidden from editing `identity.js` / `competitionParticipant.js`; Integrator exports |

### 3C Registration vs 3D Team — YES

| Field | Value |
|-------|-------|
| Can parallel | **YES** |
| Reason | Registration (IND blob path) and Team (TT format) have **NONE** hard core dependency. Different primary trees. |
| Shared files | Root index, participants barrel (if both export), shared adapters folder |
| Shared contracts | Minimal — both use Participant refs independently |
| Merge-order | Either after Wave-0; prefer after 3B merge |
| Risk | **LOW–MEDIUM** (barrel conflict only) |
| Isolation | Capability-local indexes; Integrator merges public exports |

### 3D Team vs 3E Lineup — NO (Owner-locked default)

| Field | Value |
|-------|-------|
| Can parallel | **NO — NOT ALLOWED by default** (Owner-locked 2026-07-18) |
| Reason | Lineup **HARD** depends on roster membership/locks. Same contract file `teamRosterLineup.js` and overlapping TT engines. |
| Shared files | `teamRosterLineup.js`, TT service, lineup/roster engines, participants validators |
| Shared contracts | Roster + Lineup revision model |
| Merge-order | **3D must merge before 3E** |
| Risk | **HIGH** |
| Isolation | Freeze roster contracts after 3D; 3E only lineup engines + lineup sections of validators |

### 3F Seeding vs 3G Draw — CONDITIONAL

| Field | Value |
|-------|-------|
| Can parallel | **CONDITIONAL** |
| Reason | Separate folders (`seed/` vs `draw/`). Draw **HARD** needs seed order for parity, but seed pipeline already exists — 3F can harden runtime while 3G extends adapters **if** seed contract surface frozen. |
| Shared files | Root index; `draw/adapters/seedShadowCompare.js`; seed source enums |
| Shared contracts | Seed result → draw seed input |
| Merge-order | Prefer **3F before 3G** for merge; parallel OK after seed contract freeze |
| Risk | **MEDIUM** |
| Isolation | 3G must not change `seed/**` contracts; only consume |

### 3G Draw vs 3H Match — NO (for merge) / CONDITIONAL (impl)

| Field | Value |
|-------|-------|
| Can parallel | **CONDITIONAL** — recommend **NO** until draw group graph stable |
| Reason | Match generation **HARD** depends on draw/groups. Matchmaking/formation folders are separate, so limited file conflict, but semantic dependency is hard. |
| Shared files | Root index; plan builders (legacy) if either wires Production (forbidden early) |
| Shared contracts | Draw groups → match slots |
| Merge-order | **3G before 3H** |
| Risk | **HIGH** (semantic), **MEDIUM** (files) |
| Isolation | 3H uses fixtures for draw output until 3G merges |

### 3H Match vs 3I Schedule — CONDITIONAL

| Field | Value |
|-------|-------|
| Can parallel | **CONDITIONAL** |
| Reason | Separate modules (`matchmaking`/`formation` vs `scheduling`). Schedule **HARD** needs matches. Parallel with fixture matches after match contract freeze. |
| Shared files | Root index; legacy `scheduleEngine` if either touches Production path |
| Merge-order | Prefer **3H before 3I** |
| Risk | **MEDIUM** |
| Isolation | Fixture-based schedule tests; no Production wiring |

### 3H Match vs 3K Standings — CONDITIONAL

| Field | Value |
|-------|-------|
| Can parallel | **CONDITIONAL → YES for shadow/calc** |
| Reason | Standings already has strong CC suite and can use synthetic match results. Lifecycle results (3J) are ideal but not required for standings shadow. |
| Shared files | Root index; result shape contracts (if introduced) |
| Merge-order | Standings merge can precede lifecycle if result DTO frozen |
| Risk | **MEDIUM** |
| Isolation | Freeze `StandingsMatchRecord` / result DTO early |

### 3I Schedule vs 3J Lifecycle — YES (impl) / soft order

| Field | Value |
|-------|-------|
| Can parallel | **YES** for implementation |
| Reason | Different concerns: slot assignment vs score state machine. Soft coupling via match ids. Lifecycle module is greenfield — low file collision with scheduling. |
| Shared files | Root index; future match identity types |
| Merge-order | Either; Publication waits for both |
| Risk | **MEDIUM** (lifecycle side effects Critical later) |
| Isolation | Lifecycle must not write DB/Elo in early phase; shadow only |

### 3J Lifecycle vs 3K Standings — CONDITIONAL

| Field | Value |
|-------|-------|
| Can parallel | **CONDITIONAL** |
| Reason | Standings **HARD** on match results for Production parity. Can parallel with frozen result contract + fixtures. |
| Shared files | Result DTO (new), root index |
| Merge-order | Prefer result contract from 3J before 3K Production shadow |
| Risk | **HIGH** for Production parity; **MEDIUM** for fixture shadow |
| Isolation | Result contract owned by Integrator or 3J; 3K consumes |

### 3K Standings vs 3L Publication — CONDITIONAL

| Field | Value |
|-------|-------|
| Can parallel | **CONDITIONAL** |
| Reason | Draw/schedule publish **SOFT** depends on standings. Publication is greenfield — can start after Draw+Schedule contracts exist. |
| Shared files | Root index; publish flags |
| Merge-order | Draw+Schedule before Publication; Standings optional for draw publish |
| Risk | **MEDIUM** |
| Isolation | Publication phase scoped to projection gates, not standings rewrite |

---

## Quick reference table

| Pair | Parallel? |
|------|-----------|
| 3B vs 3C | **NO** (Owner-locked initially) |
| 3B vs 3D | CONDITIONAL → YES with isolation |
| 3C vs 3D | YES |
| 3D vs 3E | **NO** (Owner-locked; 3D before 3E) |
| 3F vs 3G | CONDITIONAL |
| 3G vs 3H | CONDITIONAL (prefer sequential merge) |
| 3H vs 3I | CONDITIONAL |
| 3H vs 3K | CONDITIONAL → YES (fixtures) |
| 3I vs 3J | YES |
| 3J vs 3K | CONDITIONAL |
| 3K vs 3L | CONDITIONAL |

## Official parallelization policy

```text
Default: respect HARD merge order.
Parallel implementation allowed only when:
  1. File ownership locked
  2. Shared barrels protected (Integrator-only)
  3. Consumer uses fixtures / frozen contracts
  4. No Production wiring
```
