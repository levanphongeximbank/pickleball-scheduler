# PUBLIC-CATALOG-02 — Public DTO Allowlist

## Tournament DTO (`PUBLIC_TOURNAMENT_DTO_KEYS`)

- `id`
- `displayName`
- `slug`
- `sport`
- `publicationState`
- `operationalStatus`
- `startDate`
- `endDate`
- `locationSummary`
- `formatSummary`
- `categorySummary`
- `imageUrl`
- `updatedAt`

### Explicitly excluded

notes, staff/referees, participants/players, seeding, brackets, financial, contacts, audit, tenant secrets

## Ranking DTO (`PUBLIC_RANKING_DTO_KEYS`)

- `id`
- `displayName`
- `clubName`
- `region`
- `category`
- `gender`
- `rank`
- `totalPoints`
- `tournamentsCount`
- `bestPlacement`
- `publicationState`
- `updatedAt`

### Explicitly excluded

phone, email, member/customer IDs, private profile, adjustment history, verification notes, confidence flags, tenant IDs, writer metadata, audit fields

## Contracts

- Projector deny-by-default (`projectPublicTournament` / `projectPublicRanking`)
- SQL RPC returns only allowlisted columns (+ `total_count` for pagination metadata, stripped by repository/projector path)
- Portal mappers do not invent private fields or movement/change from non-canonical sources
