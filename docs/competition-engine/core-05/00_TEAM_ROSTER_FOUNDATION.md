# Core-05 — Team & Roster Management Foundation (Phase 1)

**Status:** Phase 1 foundation implemented (capability-local)
**Module:** `src/features/competition-core/teams/` (management service + ports)
**Branch intent:** `feature/competition-core-05-team-roster`
**Phase 0 verdict:** `READY_WITH_DEPENDENCY_CONDITIONS`

---

## 1. Purpose

Core-05 owns **persistent team identity** and **roster membership** lifecycle for Competition Core.

Phase 1 delivers:

- Additive extensions to canonical `CompetitionTeam` / `CompetitionRoster` / `CompetitionRosterMember`
- Immutable `TeamRosterSnapshot`
- In-memory management service (`createTeamRosterService`)
- Injected ports (persistence, authz, rules, eligibility, audit, classification)
- TT V6 **read/map** compatibility only

Phase 1 does **not** persist to SQL, Supabase, RPC, or Team Tournament writers.

---

## 2. Canonical entities

| Entity | Role |
|--------|------|
| **CompetitionTeam** | Competing unit identity within a competition |
| **CompetitionRoster** | People who may represent the team |
| **CompetitionRosterMember** | Membership row (person ref + role/status) |
| **TeamRosterSnapshot** | Immutable roster version artifact |

Lineup (`CompetitionLineup*`) remains **Core-06**.

---

## 3. Dependency ports

| Port | Default |
|------|---------|
| Persistence repository | In-memory only |
| Authorization | Deny (unlock requires `TEAM_ROSTER_UNLOCK`) |
| Rule adapter | Cross-team membership denied |
| Eligibility adapter | Fail closed when required |
| Classification adapter | Determines which division refs are required |
| Audit adapter | Safe no-op after successful domain ops |

Do not import unmerged Core-03/Core-04 branch internals. Use opaque refs + injected adapters.

---

## 4. Persistence limitation

Phase 1 storage is **in-memory repository instances** only.

- No `localStorage`
- No Supabase / RPC / SQL
- No Team Tournament cloud write path

Future integration requires a separate Owner-approved cutover plan.

---

## 5. Owner-approved decisions (locked)

1. Extend existing contracts — no `CompetitionTeamV2`.
2. TT V6 remains Production write SSOT.
3. `entryId` required before `activateTeam`.
4. Active cross-team membership forbidden by default (same competition + division); Rule Adapter may permit.
5. Unlock requires injected authorization + `TEAM_ROSTER_UNLOCK`.
6. Support optional `divisionId` and `divisionCategoryId`.
7. Fail closed on missing required tenant / competition / division / entry / eligibility context.
