/**
 * CORE-12 Phase 1C — Tournament Engine adapter barrel.
 * Capability-local anti-corruption surface (not a production assignment API).
 */

export {
  TE_ADAPTER_MAPPING_CODE,
  TE_ADAPTER_MAPPING_CODE_VALUES,
  createTeAdapterMappingFailure,
} from "./mappingCodes.js";

export {
  adaptTournamentEngineCourtAssignmentInput,
  mapLegacyMatchPriority,
} from "./adaptTournamentEngineCourtAssignmentInput.js";
