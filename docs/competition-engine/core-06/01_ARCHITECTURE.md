# CORE-06 — Architecture (Phase 1B Scope Freeze)

**Status:** Documentation only — no runtime implementation in Phase 1B  
**Prerequisite:** Phase 1A `READY_FOR_SCOPE_FREEZE`  
**Module home (future):** `src/features/competition-core/lineups/`  
**Production write SoT (frozen until cutover):** Team Tournament V6

---

## 1. Purpose

CORE-06 is the canonical **Lineup Management** core for Competition Engine.

It owns who is selected to play for a **team** in a single competition **context** (matchup / tie / fixture), including:

- Structure and contracts
- Domain identity and slots
- Revision chain
- Lifecycle transitions
- Injected ports (persistence, authz, policy, visibility, clock, random, audit, idempotency)

Phase 1B freezes architecture and scope only. It does **not** change Production behavior, wire writers, apply SQL, or enable flags.

---

## 2. Canonical responsibility

```text
CompetitionTeam (Core-05)
  └── CompetitionRoster (Core-05)     ← who MAY represent the team
        └── CompetitionLineup (Core-06) ← who IS selected for one context
```

| CORE-06 owns | CORE-06 does not own |
|--------------|----------------------|
| Lineup structure & status enums | Roster membership edits (Core-05) |
| Slot identity & revision immutability | Registration / eligibility adjudication (Core-03) |
| Lifecycle transition matrix (canonical) | Draw / seeding / scheduling / courts |
| Membership ⊆ roster invariants | Scoring / standings / ranking |
| Optimistic concurrency + idempotency **contracts** | Referee assignment / live score tokens |
| Injected ports (purpose only until later phases) | MLP composition catalog UI |
| TT V6 **map-only** / future shadow adapters | Private pairing formation / DreamBreaker product logic |
| Tenant + competition + team + context scoping | TT product UI / RPC / cloud writers until Owner cutover |

---

## 3. Core ownership vs Format ownership

Phase 1A freeze condition (resolves historical “KEEP IN FORMAT” vs Core promotion tension):

| Concern | Owner |
|---------|-------|
| Lineup / Slot / Revision structure | **Core-06** |
| Canonical status enum + transition matrix | **Core-06** |
| Identity keys + deterministic slot ids | **Core-06** |
| Roster-membership & duplicate-slot invariants | **Core-06** |
| Versioning / concurrency / idempotency / audit contracts | **Core-06** |
| Ports (persistence, authz, policy, visibility, clock, random) | **Core-06** (contracts) |
| MLP composition, gender, playerCount, reuse rules | **Format** (injected `LineupPolicy`) |
| Hidden-lineup reveal policy details | **Format** (via visibility policy / port) |
| Captain UX, discipline catalog, TT UI | **Format / Operations (TT V6)** |
| DreamBreaker order, forfeit product workflow | **Format (TT)** — may *consume* lineup state |
| Matchup-level state machine (`scheduled → lineup_open → …`) | **Format / Match scheduling** — Core-06 reacts to context flags |
| Production SQL / RPC / RLS writers | **TT V6** until Owner-approved cutover |

---

## 4. Dependency graph

```text
                    ┌─────────────────────┐
                    │ Opaque refs         │
                    │ tenantId            │
                    │ competitionId       │
                    │ division* (opt)     │
                    │ contextId (matchup) │
                    └─────────┬───────────┘
                              │
┌──────────────┐   ┌──────────▼──────────┐   ┌──────────────────┐
│ Core-05      │──▶│     CORE-06         │◀──│ Format LineupPolicy│
│ Team/Roster  │   │  Lineup Management  │   │ (MLP, deadline,    │
│ (membership) │   │                     │   │  visibility rules) │
└──────────────┘   └──────────┬──────────┘   └──────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐
│ Core-03 (opt)   │ │ Core-01 (opt)   │ │ Consumers (read)    │
│ eligibility via │ │ rules bridge    │ │ Match / Scoring /   │
│ port            │ │ via policy      │ │ Referee / Standings │
└─────────────────┘ └─────────────────┘ └─────────────────────┘

TT V6 product (until cutover)
  └── Owns SQL / RPC / UI writers
  └── Core-06 early phases: map-only / shadow-only — NO production writers
```

**Required scoping keys:** `tenantId`, `competitionId`, `teamId`, `rosterId` (+ `rosterVersion`), `contextId` (matchup/tie/event). Optional opaque: `divisionId`, `divisionCategoryId`, `eventId` / round — not owned by Core-06.

---

## 5. Module boundaries

| Layer | Path (existing / intended) | Role in CORE-06 |
|-------|----------------------------|-----------------|
| Domain factories | `participants/contracts/teamRosterLineup.js` | `CompetitionLineup*` factories (shared contract home) |
| Status enums | `participants/enums/statuses.js` | `COMPETITION_LINEUP_STATUS` |
| Capability runtime shell | `competition-core/lineups/**` | Phase 3E map/validate shell (dormant; not Production-wired) |
| TT product | `features/team-tournament/**` | Production write SoT |
| Identity permissions | `features/identity/constants/permissions.js` | `team.lineup.*` / `team_lineup.*` codes (align authz port) |

**Forbidden imports for Core-06 domain service (future phases, already Phase 3E rule):**

- `participants/runtime/**`
- `registrations/**`
- Deep `teams/**` (use DI ports)
- Team Tournament engines / UI from Core domain
- Supabase / app boot / capability registry at import time

**Protected (Integrator-owned):** root `competition-core/index.js`, `scripts/ci/unit-test-files.json`.

---

## 6. Existing shell vs CORE-06 target

| Artifact | Role today | CORE-06 Phase 1B stance |
|----------|------------|-------------------------|
| Phase 3E `lineups/**` | Map / normalize / transition helpers; persistence stub OFF | Preserved as dormant shell; docs freeze contracts around it |
| TT `lineupEngine` / SQL / RPC | Production writers | Remain SoT; no Core write path |
| Owner matrix row “lineup KEEP IN FORMAT” | Historical product decision | **Superseded for structure** by Core-06 freeze; Format retains policy/composition; TT retains writers until cutover |

---

## 7. Phase 1B non-goals

- No runtime code changes
- No production wiring / feature flags / shadow ON
- No SQL / migrations / RLS / RPC
- No persistence implementation beyond documenting ports
- No UI / API changes
- No commit / push / PR / deploy
