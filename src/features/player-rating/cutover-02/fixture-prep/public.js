/**
 * Browser-safe A3c exports (no scoring engine, no node:crypto, no trusted orchestrator).
 */

export {
  FIXTURE_PREP_VERSION,
  FIXTURE_COHORT_LABEL,
  FIXTURE_PREP_OUTCOME,
  SELECTED_ARCHITECTURE,
  DIRECT_RPC_BYPASS_STATUS,
  MUTATION_BUDGET,
  MAPPING_STATUS,
  NORMALIZED_EQUIVALENCE,
} from "./constants.js";

export { APPROVED_ID_HASHES, FIXTURE_MANIFEST_META } from "./fixtureManifestMeta.js";

export { isFixturePrepPathEnabled, FIXTURE_PREP_ENV_NAME } from "./featureFlag.js";

export {
  invokeFixturePrepFromBrowser,
  browserFixturePrepForbiddenPatterns,
} from "./clientInvoke.js";
