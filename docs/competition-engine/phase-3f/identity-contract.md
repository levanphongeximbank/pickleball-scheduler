# Identity Contract — Phase 3F

## Match

```text
competitionId::MATCH::contextId
```

`contextId` identifies one playable match (TT SubMatch granularity).  
Producer may compose e.g. `matchupId::subMatchId` into `contextId` before resolve.

## Side

```text
{matchIdentityKey}::SIDE::{A|B}
```

## Stability

Identity does **not** change when:

- schedule time changes
- court assignment changes
- referee assignment changes
- lineup references change
- match is postponed
- scores change (scores are not Core identity inputs)

## Forbidden identity inputs

Display labels, participant/team names, timestamps, random UUIDs, scores, winner, status, mutable court/referee metadata.
