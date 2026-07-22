/**
 * CORE-12 Phase 1C — compatibility helpers for TE shadow parity.
 *
 * Dedicated capability-local compatibility surface.
 * Not part of the production assignCourtsDeterministic API.
 *
 * The TE anti-corruption adapter is exported here as a legitimate mapping API
 * for hosts that must adapt explicit TE-shaped snapshots into CourtAssignmentRequest
 * without cutting over production TE. It does not assign courts.
 */

export {
  LEGACY_SUCCESS_CLASS,
  LEGACY_SUCCESS_CLASS_VALUES,
  normalizeLegacySuccessHeuristic,
} from "./legacySuccessHeuristic.js";

export { normalizeLegacyAssignCourtsResult } from "./normalizeLegacyAssignCourtsResult.js";

/** TE → CORE-12 request mapping (anti-corruption only). */
export {
  adaptTournamentEngineCourtAssignmentInput,
  mapLegacyMatchPriority,
  TE_ADAPTER_MAPPING_CODE,
  TE_ADAPTER_MAPPING_CODE_VALUES,
  createTeAdapterMappingFailure,
} from "../adapters/te-compat/index.js";
