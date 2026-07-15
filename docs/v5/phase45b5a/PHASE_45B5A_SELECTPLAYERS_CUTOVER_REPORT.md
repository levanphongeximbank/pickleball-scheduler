# PHASE 45B.5A — SelectPlayers Canonical Candidate Cutover

**Scope:** Xếp sân / `SelectPlayers` discovery only.

## Change

- Discovery uses `loadSelectPlayersCandidatePool` → `pairingCandidateService.listCandidates`.
- Live injectables: `club_list_members` + `profiles` + `athletes` (no blob).
- UI player `id` = `athletes.id` (`pairingIdentityId`); profile/blob ids are aliases only.
- Cloud/repository errors surface as explicit error state — never silent “0 athletes” via blob fallback.
- Gender filtering remains via existing `getEligiblePlayersForCompetition`.

## Out of scope

Daily Play, Team, Tournament, Private Pairing, SQL, feature flags, Restore UI.
