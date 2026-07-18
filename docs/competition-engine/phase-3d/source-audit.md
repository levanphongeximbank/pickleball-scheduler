# Source Audit Summary — Phase 3D

Full audit delivered before Owner GO; implementation follows Owner architecture locks.

## Legacy SSOT

| Concern | SSOT |
|---------|------|
| Team create / update | `team-tournament/engines/teamTournamentEngine.js` + `models` (`createTeamRecord`) |
| Roster membership / warnings | `team-tournament/engines/teamRosterEngine.js` |
| Orchestration / cloud | `teamTournamentService.js`, blob/cloud repos, TT RPCs |
| Canonical Team / Roster | Derived mapping only via Team Runtime (`competition-core/teams/**`) |

## Production

Legacy Team Runtime remains Production primary. Canonical Team/Roster Runtime callers: **NONE**.

## Identity risks addressed

Deterministic keys:

- `competitionId::TEAM::stableTeamId`
- `competitionId::ROSTER::teamId`
- `competitionId::ROSTER_MEMBER::teamId::kind:id`

Collision refuses overwrite. No timestamp / random / array-index identity.

## Explicit non-scope (audit)

Lineup, Scheduling, MLP algorithms, Substitution workflow, Match engine, Registration Runtime edits.
