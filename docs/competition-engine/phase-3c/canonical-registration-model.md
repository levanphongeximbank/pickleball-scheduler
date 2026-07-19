# Canonical Registration Model — Phase 3C

## Required fields (Registration Runtime always populates)

| Field | Notes |
|-------|-------|
| `id` (registrationId) | e.g. `reg:ind:{entryId}` or team source id |
| `competitionId` | Required (OD-03 family) |
| `registrationKind` | `INDIVIDUAL` \| `TEAM` |
| `sourceType` | see source-type enum |
| `sourceId` | stable source identity |
| `identityKey` | deterministic key |
| `status` | canonical registration status |
| `memberRefs` | participant references (may be empty for draft/team edge cases) |

## Optional (explicit null)

`entryId`, `waitlistPosition`, `participantId`, `windowId`, `submittedAt`, `decidedAt`, `decidedBy`, `rejectionReason`, `registeredByPlatformUserId`, `metadata`, `extensions`, `audit`

## Metadata (non-identity)

- Pair: `pairType`, `partnerInviteToken`, `entryRole` (`singles`/`doubles`)
- Team: `teamId`, `captainPlayerId`, `captainRole`
- Guest: preserved via `memberRefs[].kind = GUEST` (not a registration kind)

## Not in identity

Display name, UI labels, raw database rows.
