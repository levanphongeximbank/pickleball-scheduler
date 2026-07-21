/**
 * CORE-06 Phase 1F — integration path for Team Tournament compatibility utilities.
 *
 * NOT the canonical CORE-06 public API.
 * Future TT adapter may import from this path for fixture/mapping helpers.
 * Production must not treat fixture doubles as the Production implementation.
 *
 * Dependency direction:
 *   Team Tournament future adapter → CORE-06 canonical API
 *   (this module is optional fixture/compat support; CORE-06 never imports TT runtime)
 *
 * Classifications:
 *   FORMAT_INTEGRATION_API — TT compatibility matrix + mappers
 *   TEST_ONLY — fixture adapter, in-memory TX, parity catalog
 */

export {
  TT_CORE06_COMPATIBILITY_MATRIX,
  findCompatibilityRow,
} from "../adapters/teamTournamentCompatibility.js";

export { mapTeamTournamentLineupInputToCanonical } from "../adapters/mapTeamTournamentInput.js";

export {
  mapCanonicalLineupResultToTeamTournament,
  CANONICAL_FIELDS_NOT_IN_LEGACY,
} from "../adapters/mapCanonicalToTeamTournament.js";

export { createFixtureLineupFormatAdapter } from "../adapters/createFixtureLineupFormatAdapter.js";

export {
  LINEUP_ACCEPTED_DIFFERENCE_CODE,
  LINEUP_ACCEPTED_DIFFERENCE_CODE_VALUES,
  LINEUP_ACCEPTED_DIFFERENCE_REGISTRY,
  isLineupAcceptedDifferenceCode,
} from "../contracts/acceptedDifferences.js";

export {
  LINEUP_PARITY_SCENARIOS,
  summarizeParityCatalog,
  validateParityCatalog,
} from "../certification/parityScenarios.js";

/** TEST_ONLY — in-memory persistence TX double (not Production storage). */
export {
  createInMemoryLineupPersistenceTransactionPort,
  LINEUP_PERSISTENCE_TX_IMPL_KIND,
} from "../persistence/index.js";
