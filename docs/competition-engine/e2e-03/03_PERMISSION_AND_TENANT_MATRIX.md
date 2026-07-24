# E2E-03 — Permission and Tenant Matrix

## Principle

- Logical capability ids (`competition.*`) are **documentation / projection** labels only.
- Enforcement uses **Identity** permission strings via E2E-01 + CORE-02 `evaluateAuthorization`.
- Never trust client `grantedPermissions`.
- No SUPER_ADMIN hard-coded bypass in Organizer facade.

## Action → Identity permissions (OR)

| Organizer action | Logical capability | Required Identity permissions (any) | Venue required |
|------------------|--------------------|--------------------------------------|----------------|
| `organizer.operations.read` | `competition.operations.read` | `tournament.view` | no |
| `organizer.operations.prepare` | ops prepare | `tournament.update` | no |
| `organizer.participants.lock` | `competition.participants.lock` | `tournament.update` | no |
| `organizer.draw.prepare` | `competition.draw.prepare` | `tournament.update` \| `director.use` | no |
| `organizer.schedule.prepare` | `competition.schedule.prepare` | `scheduling.run` \| `tournament.update` | **yes** |
| `organizer.courts.confirm` | `competition.courts.confirm` | `director.use` \| `tournament.update` | **yes** |
| `organizer.checkin.manage` | `competition.checkin.manage` | `tournament.update` \| `director.use` | no |
| `organizer.matches.control` | `competition.matches.control` | `director.use` \| `match.update` | no |
| `organizer.knockout.activate` | `competition.knockout.activate` | `director.use` \| `tournament.update` | no |
| `organizer.publish` | `competition.publish` | `tournament.update` \| `tournament.certify` | no |
| `organizer.complete` | `competition.complete` | `tournament.update` \| `director.use` | no |
| `organizer.archive.prepare` | `competition.archive.prepare` | `tournament.update` \| `tournament.certify` | no |

## Tenant / scope

| Check | Behavior |
|-------|----------|
| Missing `actorId` / `role` | `E2E03_MISSING_IDENTITY` |
| Missing `tenantId` | `E2E03_MISSING_TENANT` |
| Missing `competitionId` | `E2E03_MISSING_COMPETITION` |
| Missing `venueId` when required | `E2E03_MISSING_VENUE` |
| Evidence tenant ≠ scope tenant | `E2E03_CROSS_TENANT_REJECTED` |
| Permission miss | `E2E03_PERMISSION_DENIED` |
| Client grants present | `E2E03_CLIENT_GRANT_TRUST_REJECTED` |

## Closure scope (BG-08)

**CLOSED for Organizer Operations path only** — not portal-wide / player / referee / public paths.
