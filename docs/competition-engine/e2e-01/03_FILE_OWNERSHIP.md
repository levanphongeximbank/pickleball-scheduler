# E2E-01 — File Ownership

## Owned (this workstream)

```text
src/features/competition-engine/
  index.js
  integration/
    index.js
    constants.js
    errors.js
    context/requireIntegrationContext.js
    adapters/
      identityEvidenceFromIdentityAdapter.js
      membershipStatusFromClubAdapter.js
      playerParticipantLookupAdapter.js
      rankingRatingSnapshotFromRatingAdapter.js
      venueCourtFromVenueAdapter.js
    composition/createCompetitionRuntimePorts.js
    inventory/adapterInventory.js
tests/competition-engine-e2e-01-integration-foundation.test.js
docs/competition-engine/e2e-01/**
```

## Consumed (import only)

- `src/features/competition-core/role-permission/**`
- `src/features/competition-core/registration-eligibility/ports/**`
- `src/features/competition-core/participants/compatibility/mapPlayerClubRead.js`
- `src/features/competition-core/seeding/ports/RankingRatingSnapshotProviderPort.js`
- `src/features/competition-core/court-assignment/adapters/availability/**`
- `src/features/identity/matrix/rolePermissions.js`, `constants/roles.js`
- `src/features/club/constants/clubMemberRoles.js`
- `src/features/player/services/getPlayerProfile.js`
- `src/features/venue-court/adapters/competitionCourt*.js`

## Forbidden

- `src/core/platform/**` edits
- Reopening CLOSED CM/Core capability folders
- `package.json` / `package-lock.json` changes
- SQL / remote Supabase / deploy / secrets
- Parallel engines for seeding, schedule, court assign, scoring, etc.
