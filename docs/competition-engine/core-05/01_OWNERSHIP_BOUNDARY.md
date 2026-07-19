# Core-05 — Ownership Boundary

**Module:** `src/features/competition-core/teams/`
**Capability-local public surface:** `teams/index.js`
**Protected:** root `competition-core/index.js`, `unit-test-files.json` (Integrator-owned)

---

## 1. Core-05 owns

- Competition team identity (stable id + identity key)
- Roster membership lifecycle (add / remove / replace / captain)
- Roster lock / unlock (unlock via authz)
- Roster validation invariants
- Roster versioning + immutable snapshots
- In-memory persistence port implementation for tests
- TT V6 → canonical **map-only** compatibility adapter

---

## 2. Core-05 does not own

| Concern | Owner |
|---------|-------|
| Player profile identity | Player Management |
| Registration workflow | Core-03 |
| Eligibility adjudication | Core-01 / Core-03 (via eligibility port) |
| Automatic team formation | `formation/` |
| Lineup selection / revisions | Core-06 |
| Seeding / draw / schedule / score / standings | Other cores |
| Team Tournament UI / engines / RPC / cloud writers | TT V6 product |
| SQL migrations | Deferred |

---

## 3. Roster versus lineup

```text
CompetitionTeam
  └── CompetitionRoster          ← Core-05 (who may play for the team)
        └── CompetitionLineup*   ← Core-06 (who plays in one matchup/context)
```

Anti-patterns:

- Treating Daily Play court sides as CompetitionTeam
- Mapping lineup `selections` into roster membership
- Treating TT `lockedPlayerIds` as canonical `ROSTER_LOCKED`

---

## 4. Team Tournament V6 SSOT protection

Production writes remain TT V6:

- `team-tournament` engines / services / RPC / cloud repositories

Core-05 Phase 1 may:

- Map TT-shaped objects → canonical Team/Roster
- Run fixture / parity tests

Core-05 Phase 1 must **not**:

- Call TT RPC / cloud save / SQL
- Modify TT engines or UI

---

## 5. Future integration conditions

Integration with TT write path or SQL requires Owner approval covering:

1. Dual-write vs cutover strategy
2. Ownership of `team_tournament_teams` / `_team_members`
3. Backfill / rollback
4. Feature-flag / shadow parity gates
