# E2E-01 — Canonical Source-of-Truth Map

| Adapter | Canonical SoT | Port consumed | Integration adapter |
|---------|---------------|---------------|---------------------|
| INT-01 Identity & Permission | `src/features/identity/` role matrix (`getPermissionsForRole`, `normalizeRole`) | CORE-02 `IdentityEvidencePort` | `createIdentityEvidenceFromIdentityAdapter` |
| INT-02 Venue & Court | `src/features/venue-court/` CAA + descriptor public adapters | CORE-12 `VenueEligibilityProvider` + `CanonicalCourtDescriptorProvider` → `createInjectedVenueCourtAvailabilityProvider` | `createVenueEligibilityFromCaaAdapter`, `createCanonicalDescriptorFromVenueAdapter` |
| INT-03 Player Profile | `src/features/player/` `getPlayerProfile` | Core `ParticipantLookupPort` + `mapPlayerProfileToParticipantReference` | `createPlayerParticipantLookupAdapter` |
| INT-04 Club | Club membership SSOT (`getActiveMembershipForUser` injected) | CORE-03 `MembershipStatusPort` | `createMembershipStatusFromClubAdapter` |
| INT-05 Player Rating | Injected rating read (`resolveRatings`) — Player Rating read facade / product reads | CORE-07 `RankingRatingSnapshotProviderPort` | `createRankingRatingSnapshotFromRatingAdapter` |

## Composition root

`createCompetitionRuntimePorts(deps)` returns the DI bag used by future E2E vertical slices.

## Rules

1. Competition Engine **does not own** Identity, Club, Player, Rating, or Venue data.
2. Missing identity / tenant / venue / club / permission → **fail-closed**.
3. Client-sent role grants are **ignored**.
4. No parallel RBAC, no parallel engines, no Platform Core edits.
5. Core/CM CLOSED modules are **imported only**.
