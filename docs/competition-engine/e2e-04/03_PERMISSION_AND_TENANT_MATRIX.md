# E2E-04 — Permission and Tenant Matrix

## Principle

- Logical capability ids are documentation / projection labels only.
- Enforcement uses Identity permission strings via E2E-01 + CORE-02.
- Never trust client `grantedPermissions`.
- No SUPER_ADMIN hard-coded bypass.

## Player action → Identity permissions (OR)

| Action | Capability | Required permissions (any) |
|--------|------------|----------------------------|
| `player.operations.read` | `competition.player.read` | `tournament.view` |
| `player.checkin.self` | `competition.player.checkin.self` | `tournament.view` \| `player.update` |
| `player.schedule.read` | `competition.player.schedule.read` | `tournament.view` |
| `player.match.read` | `competition.player.match.read` | `tournament.view` |
| `player.standings.read` | `competition.player.standings.read` | `tournament.view` \| `statistics.view` |
| `player.qualification.read` | `competition.player.qualification.read` | `tournament.view` \| `statistics.view` |
| `player.knockout.read` | `competition.player.knockout.read` | `tournament.view` |
| `player.final_result.read` | `competition.player.final_result.read` | `tournament.view` \| `statistics.view` |

Additional ownership gates: canonical player mapping + entry ownership.

## Referee action → Identity permissions (OR)

| Action | Capability | Required permissions (any) |
|--------|------------|----------------------------|
| `referee.assignment.read` | `competition.referee.assignment.read` | `tournament.view` |
| `referee.assignment.acknowledge` | `competition.referee.assignment.acknowledge` | `tournament.view` \| `match.update` |
| `referee.match.open/suspend/resume` | `competition.referee.match.control` | `match.update` |
| `referee.score.session/submit` | `competition.referee.score.submit` | `match.update` |
| `referee.result.submit/correct` | result submit/correct | `match.update` \| `team.match.result.manage` |
| `referee.result.read` | `competition.referee.result.read` | `tournament.view` \| `statistics.view` |

Additional assignment gates: refereeId + tenant + competition + match + active assignment status.

## Fail-closed codes

| Condition | Player | Referee |
|-----------|--------|---------|
| Missing identity | `E2E04_PLAYER_MISSING_IDENTITY` | `E2E04_REFEREE_MISSING_IDENTITY` |
| Missing tenant | `E2E04_PLAYER_MISSING_TENANT` | `E2E04_REFEREE_MISSING_TENANT` |
| Cross-tenant | `E2E04_PLAYER_CROSS_TENANT_REJECTED` | `E2E04_REFEREE_CROSS_TENANT_REJECTED` |
| Client grants | `E2E04_PLAYER_CLIENT_GRANT_TRUST_REJECTED` | `E2E04_REFEREE_CLIENT_GRANT_TRUST_REJECTED` |
| Wrong ownership / assignment | `E2E04_PLAYER_ENTRY_NOT_OWNED` / `WRONG_PLAYER_ID` | `E2E04_REFEREE_NOT_ASSIGNED` |

## BG-08 closure scope

**CLOSED for Player Operations path and Referee Operations path** within E2E-04 facades.
Not a claim for Public Experience (E2E-05) or portal-wide production wiring.
