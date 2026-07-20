# CORE-06 — Scope Boundary (Phase 1B Scope Freeze)

**Status:** Frozen minimum canonical boundary from Phase 1A  
**Rule:** Do not invent functionality. Do not widen scope.

---

## 1. IN SCOPE

### Domain

- `CompetitionLineup`, `CompetitionLineupSlot`, `CompetitionLineupRevision`
- `VisibilityGrant` and `MissingLineupResolution` **contracts**
- Identity keys + deterministic slot ids
- Lifecycle: draft → submit → lock → publish → override/supersede → void
- Roster-membership invariants + duplicate-slot rules (core)
- Composition validation **via injected policy** (not Format code inside Core)

### Cross-cutting contracts

- Lock deadline evaluation (policy + injected clock)
- Hidden-until-publish / re-hide-on-override visibility contracts
- Deterministic random submission fallback **port** (seeded; Format supplies algorithm or seed)
- Authz boundaries for captain, manager/BTC/TD, referee (read), system
- Versioning, idempotency, concurrency, audit **ports**
- Tenant + competition + team + context scoping
- TT V6 **map-only** / future shadow adapters (read path)

### Ownership summary

CORE-06 owns: structure, contracts, ports, domain, lifecycle, identity, revision model.

---

## 2. OUT OF SCOPE

| Area | Why out | Owner |
|------|---------|-------|
| **Draw** | Bracket / grouping generation | Draw / Format cores |
| **Seeding** | Seed order / snake / AI balance | Seeding core / Format |
| **Schedule** | Matchup scheduling, round calendars | Scheduling core / Format |
| **Court** | Court assignment / venue ops | Court / Operations |
| **Referee** | Referee assignment, live score tokens, V5 provision | Referee / TT ops |
| **Scoring** | Rally scoring, result confirm | Scoring core / Format |
| **Standings** | Tables, tie-break product logic | Standings core / Format |
| **Ranking** | Season Elo / season BXH | Season / ranking modules |
| **Registration** | Signup, waitlist, capacity | Core-03 |
| **Roster editing** | Add/remove/replace members, roster lock | Core-05 |
| **Eligibility adjudication** | Who may register / qualify | Core-03 / Core-01 (consume via port only) |
| **Private Pairing** | Pairing rule admin / formation runtime | Private pairing / formation |
| **DreamBreaker** | Order / product workflow | Format (TT) — may consume lineup state |
| **Forfeit product workflow** | TT-4 forfeit UX/RPC | Format (TT) |
| **Individual doubles “team”** | Entry pair ≠ CompetitionTeam | Participant / Entry |
| **Daily Play court sides** | Ephemeral sides ≠ CompetitionLineup | Match lifecycle (optional MatchSide later) |
| **Production SQL/RPC cutover** | Writers stay TT until Owner gate | TT V6 + Owner |
| **Feature-flag ON / UI rewrite** | Later Owner-gated phases | Integrator / Owner |
| **MLP discipline catalog UI** | Format product surface | TT UI |

---

## 3. Explicit adjacency notes

### Draw / Schedule / Court

Lineup may **reference** `contextId` from a scheduled matchup. Core-06 does not create fixtures, courts, or draw nodes.

### Referee

Referee portals may **read** published lineups for assigned matchups. Core-06 does not assign referees or gate V5 match load (TT-5 security remains product concern).

### Scoring / Standings / Ranking

Consumers of published lineup snapshots only. No write-back into lineup domain from scoring.

### Registration / Roster

Registration produces eligibility for roster membership (Core-03/05). Lineup selects from roster; it never edits roster.

### Private Pairing

Pairing formation is a separate domain. Do not fold pairing rules into Core-06.

### DreamBreaker

DreamBreaker order and forfeit flows may **read** lineup/publish status. They are not Core-06 entities or transitions.

---

## 4. Documented conflict (frozen resolution)

| Source | Statement | Phase 1B resolution |
|--------|-----------|---------------------|
| `14_OWNER_DECISION_MATRIX.md` | lineup **KEEP IN FORMAT** | Superseded for **structure/lifecycle/ports** by CORE-06; Format keeps composition/visibility policy; TT keeps Production writers until cutover |
| Core-05 docs | Lineup → Core-06 | Affirmed |
| Phase 3E | Dormant map/validate shell | Affirmed; not Production SoT |

---

## 5. Phase plan reminder (do not implement in 1B)

| Phase | Goal |
|-------|------|
| 1A | Discovery *(complete)* |
| **1B** | Foundation docs + freeze *(this package)* |
| 1C | Domain service: transitions, membership, revision immutability, authz/policy DI — no production writers |
| 1D | Deterministic random port + missing-lineup contracts |
| 1E | Visibility + deadline + concurrency/idempotency; zero opponent leak tests |
| 1F | Persistence foundation (in-memory → optional SQL draft) — flag OFF |
| 1G | TT map/shadow parity (read); no dual-write without Owner |
| Later | Dual-write / cutover / SQL RLS / UI adapter — Owner-approved only |
