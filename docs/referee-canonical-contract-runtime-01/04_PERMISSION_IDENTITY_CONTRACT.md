# Permission and identity contract

## Frozen generic capabilities / Identity permissions

| Capability | Permission id |
|---|---|
| competition.referee.assignment.read | `PERMISSIONS.COMPETITION_REFEREE_ASSIGNMENT_READ` |
| competition.referee.assignment.manage | organizer |
| competition.referee.assignment.acknowledge | referee |
| competition.referee.match.control | referee |
| competition.referee.score.submit | referee |
| competition.referee.result.submit | referee |
| competition.referee.result.correct | referee |
| competition.referee.result.read | referee |
| competition.referee.incident.report | referee |

E2E-04 `REFEREE_ACTION_PERMISSION_MAP` uses only these. It does **not** require `TEAM_MATCH_RESULT_MANAGE`.

Team Tournament may keep `team.match.result.manage` on its own engine/UI. Generic referee operations must not.

## Identity

- Canonical identity = `auth.uid` = `actor.actorId`
- `refereeId`, if present, must equal `actor.actorId`
- Client `grantedPermissions` remain rejected
- Name/email/phone matching is not authority

## Legacy fuzzy paths (do not delete this run)

| Path | Classification |
|---|---|
| `identity/services/refereeSessionService.js` `refereeMatchesUser` | LEGACY_TO_RETIRE |
| Daily Play directory `matchesSearch` | search filter only, not authority |
| Individual/legacy `refereeName` roster strings | COMPATIBILITY_ONLY display |

Cutover: mode adapters must resolve assignment by canonical user id from CORE-13 / `referee_assignments.referee_user_id`.
