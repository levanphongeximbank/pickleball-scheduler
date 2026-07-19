# Identity Contract — Phase 3G

## Operation

```text
competitionId::SEEDING::contextId
```

## Candidate

```text
seedingIdentityKey::CANDIDATE::candidateReference
```

## Assignment

```text
seedingIdentityKey::SEED::{seedNumber}
```

## Included

- `competitionId`
- `contextId` (event / division / seeding context — Owner-stable)
- `candidateReference` (entry / team / participant token)
- `seedNumber` (assignment only)

## Excluded

- display name
- mutable rating
- mutable ranking
- timestamps
- random UUID
- court / referee / schedule
- score / winner
