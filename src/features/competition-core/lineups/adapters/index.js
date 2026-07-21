/**
 * CORE-06 Phase 1F — adapter barrel.
 *
 * Legacy resolve adapter remains for Phase 3E.
 * Team Tournament fixture/compat helpers are FORMAT_INTEGRATION / TEST_ONLY —
 * consumers should prefer `../integration/` rather than treating them as
 * generic CORE-06 canonical APIs.
 */

export {
  createLegacyLineupAdapter,
  LegacyLineupAdapter,
} from "./LegacyLineupAdapter.js";

export { createFixtureLineupFormatAdapter } from "./createFixtureLineupFormatAdapter.js";

export {
  TT_CORE06_COMPATIBILITY_MATRIX,
  findCompatibilityRow,
} from "./teamTournamentCompatibility.js";

export { mapTeamTournamentLineupInputToCanonical } from "./mapTeamTournamentInput.js";

export {
  mapCanonicalLineupResultToTeamTournament,
  CANONICAL_FIELDS_NOT_IN_LEGACY,
} from "./mapCanonicalToTeamTournament.js";
