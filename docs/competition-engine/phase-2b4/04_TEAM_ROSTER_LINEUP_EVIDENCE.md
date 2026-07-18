# 04 — Team / Roster / Lineup Evidence

| Check | Result |
|-------|--------|
| Captain preserved | `captainPlayerId` → `captainRef.id` |
| Roster members preserved | member count + ids |
| Duplicate roster member | `INVALID_ROSTER_STATE` |
| Locked roster no direct mutate | `assertRosterNotDirectlyMutatedWhenLocked` |
| Substitution / amendment | `amendments[]` without rewriting history object |
| Lineup first revision valid | revisions ≥ 1; sequence validator PASS |
| Monotonic revisions | decrease / duplicate rejected |
| Locked lineup immutable | `assertLineupRevisionImmutableWhenLocked` |
| Hidden lineup | Format extension `hiddenLineupPolicyRef` only |
| Dreambreaker / MLP | Not present on Core lineup contract |
