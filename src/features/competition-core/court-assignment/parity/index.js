/**
 * CORE-12 Phase 1C — shadow-parity barrel (not a production assignment API).
 *
 * Do not import from court-assignment/index.js production surface.
 */

export {
  CORE12_PARITY_CLASSIFICATION_PRECEDENCE_V1,
  PARITY_CLASSIFICATION,
  PARITY_CLASSIFICATION_VALUES,
  PARITY_CLASSIFICATION_ORDER,
  PARITY_CLASSIFICATION_ENTRY_CONDITIONS,
  resolveFinalParityClassification,
} from "./classifications.js";

export {
  CORE12_DIVERGENCE_CATALOG_V1,
  INTENTIONAL_DIVERGENCE_CATALOG,
  getIntentionalDivergence,
  listIntentionalDivergenceIds,
} from "./intentionalDivergences.js";

export {
  normalizeCore12ResultForParity,
  assignmentMapsEqual,
} from "./normalizeForParity.js";

export { compareLegacyAndCore12CourtAssignment } from "./compareLegacyAndCore12CourtAssignment.js";

export {
  runLegacyAssignCourtsReference,
  legacyMatchImportance,
  legacyCourtsByPriority,
  legacyTimeOverlaps,
  legacyValidateCourtAssignmentInput,
} from "./legacyReferenceAssignCourts.js";

export {
  CORE12_LEGACY_SOURCE_ANCHOR_V1,
  LEGACY_SOURCE_ANCHOR,
  LEGACY_TE_COURT_ASSIGNMENT_SOURCE_PATH,
  LEGACY_TE_COURT_ASSIGNMENT_AUDITED_COMMIT,
  LEGACY_TE_COURT_ASSIGNMENT_SOURCE_SHA256,
  LEGACY_TE_COURT_ASSIGNMENT_BEHAVIOR_MARKERS,
  sha256HexUpper,
  detectLegacyTeCourtAssignmentDrift,
} from "./legacySourceAnchor.js";

export { runShadowParity } from "./runShadowParity.js";
