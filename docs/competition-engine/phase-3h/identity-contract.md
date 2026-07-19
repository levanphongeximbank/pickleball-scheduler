# Identity Contract — Phase 3H

## Operation

`{competitionId}::DRAW::{contextId}`

## Candidate

`{drawIdentityKey}::CANDIDATE::{candidateReference}`

Foreign Phase 3G `candidateIdentityKey` values may be preserved when supplied via seedAssignments.

## Group

`{drawIdentityKey}::GROUP::{groupNumber}` (1-based)

## Bracket

`{drawIdentityKey}::BRACKET::{bracketId}` (default `main`)

## Slot

`{drawIdentityKey}::SLOT::{slotNumber}` (1-based)

## Placement

`{drawIdentityKey}::PLACEMENT::{candidateIdentityKey}`

## Bye

`{drawIdentityKey}::BYE::{slotNumber}`

## Exclusions

Identity must not depend on:

- display name
- mutable rating / ranking
- timestamps
- random UUID
- court / referee / schedule / score / winner
