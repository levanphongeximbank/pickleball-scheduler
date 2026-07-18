# 02 — Cross-Format Identity Evidence

Verified kinds (OD-01):

- PLATFORM_USER
- PLAYER_PROFILE
- ATHLETE
- CLUB_MEMBER
- GUEST
- EXTERNAL

Evidence:

- Kind+id pairs do not collide across kinds with the same raw id string.
- Display name changes do not rewrite person id.
- Snapshot fields do not rewrite person id.
- Alias link (`linkParticipantReferenceAlias`) keeps guest kind/id; profile is alias only.
- Guest linked to profile still validates as CompetitionParticipant.
