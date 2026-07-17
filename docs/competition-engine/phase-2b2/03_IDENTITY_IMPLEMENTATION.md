# 03 — Identity Implementation

## Reference kinds

```text
PLATFORM_USER
PLAYER_PROFILE
ATHLETE
CLUB_MEMBER
GUEST
EXTERNAL
```

These are distinct ID spaces. Core never treats them as interchangeable.

## OD-01 guest support

- Guest may exist without platform account or player profile.
- `linkParticipantReferenceAlias` adds alias tokens only.
- Primary `kind` + `id` remain unchanged after linking.

## Separated identities

Do not equate:

```text
platformUserId
playerProfileId
athleteId
clubMemberId
competitionParticipantId
competitionEntryId
teamId
rosterMemberId
lineupSlotId
```

## Snapshots

`ParticipantSnapshot` captures display/rating/eligibility/affiliation/identity reference + `snapshotAt`.  
It does **not** replace the source profile.
