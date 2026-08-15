# Result revision contract

CORE-16 calculated score ≠ CORE-15 completed lifecycle ≠ CORE-17 accepted result.

Only CORE-17 **ACCEPTED ACTIVE** results persist as official `match_result_revisions`.

- Unaccepted / PENDING cannot become official.
- Correction = new revision, `supersedes_revision` set, previous row retained.
- No silent UPDATE of historical official payload.
- Result propagation to tournament modes is Adapter B later. Outbox is not consumed here.

Live mapping: `confirmed` first official row; later correction `overridden` + `supersedes_revision`. App lineage: ACTIVE / SUPERSEDED.
